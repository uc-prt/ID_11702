
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Components\Header.svelte generated by Svelte v3.44.3 */

    const file$4 = "src\\Components\\Header.svelte";

    // (17:4) {#if menu==false}
    function create_if_block$2(ctx) {
    	let span;
    	let input;
    	let t0;
    	let label;
    	let t2;
    	let button;

    	const block = {
    		c: function create() {
    			span = element("span");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			label.textContent = "Review";
    			t2 = space();
    			button = element("button");
    			button.textContent = "V2.0";
    			attr_dev(input, "class", "form-check-input");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "role", "switch");
    			attr_dev(input, "id", "chk_switch");
    			add_location(input, file$4, 18, 8, 778);
    			attr_dev(label, "class", "form-check-label");
    			attr_dev(label, "for", "chk_switch");
    			add_location(label, file$4, 19, 8, 867);
    			attr_dev(span, "class", "form-check form-switch reviewchk");
    			add_location(span, file$4, 17, 4, 721);
    			attr_dev(button, "class", "btn btn-primary version p-0 px-1");
    			add_location(button, file$4, 23, 4, 973);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, input);
    			append_dev(span, t0);
    			append_dev(span, label);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, button, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(17:4) {#if menu==false}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let nav;
    	let img;
    	let img_src_value;
    	let t0;
    	let span1;
    	let span0;
    	let t2;
    	let ul;
    	let li0;
    	let t4;
    	let li1;
    	let t6;
    	let if_block = /*menu*/ ctx[0] == false && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			img = element("img");
    			t0 = space();
    			span1 = element("span");
    			span0 = element("span");
    			span0.textContent = "TOOLS";
    			t2 = space();
    			ul = element("ul");
    			li0 = element("li");
    			li0.textContent = "XML";
    			t4 = space();
    			li1 = element("li");
    			li1.textContent = "Show Algorithmic";
    			t6 = space();
    			if (if_block) if_block.c();
    			attr_dev(img, "class", "img-fluid");
    			if (!src_url_equal(img.src, img_src_value = "http://localhost/pe-gold3/layout/themes/bootstrap4/images/logo/ucertify_logo.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "ucertify_logo");
    			add_location(img, file$4, 4, 4, 76);
    			attr_dev(span0, "class", "btn btn-light ");
    			attr_dev(span0, "data-bs-toggle", "dropdown");
    			attr_dev(span0, "aria-expanded", "false");
    			add_location(span0, file$4, 6, 8, 246);
    			attr_dev(li0, "class", "dropdown-item py-2");
    			attr_dev(li0, "data-bs-toggle", "modal");
    			attr_dev(li0, "data-bs-target", "#exampleModal");
    			add_location(li0, file$4, 10, 12, 473);
    			attr_dev(li1, "class", "dropdown-item py-2");
    			add_location(li1, file$4, 13, 12, 612);
    			attr_dev(ul, "class", "dropdown-menu position-absolute top-0 pt-2");
    			attr_dev(ul, "aria-labelledby", "dropdownMenuLink");
    			add_location(ul, file$4, 9, 8, 369);
    			attr_dev(span1, "class", "dropdown");
    			add_location(span1, file$4, 5, 4, 213);
    			attr_dev(nav, "class", "border-bottom");
    			add_location(nav, file$4, 3, 0, 43);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, img);
    			append_dev(nav, t0);
    			append_dev(nav, span1);
    			append_dev(span1, span0);
    			append_dev(span1, t2);
    			append_dev(span1, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t4);
    			append_dev(ul, li1);
    			append_dev(nav, t6);
    			if (if_block) if_block.m(nav, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*menu*/ ctx[0] == false) {
    				if (if_block) ; else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(nav, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	let { menu } = $$props;
    	const writable_props = ['menu'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('menu' in $$props) $$invalidate(0, menu = $$props.menu);
    	};

    	$$self.$capture_state = () => ({ menu });

    	$$self.$inject_state = $$props => {
    		if ('menu' in $$props) $$invalidate(0, menu = $$props.menu);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [menu];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { menu: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*menu*/ ctx[0] === undefined && !('menu' in props)) {
    			console.warn("<Header> was created without expected prop 'menu'");
    		}
    	}

    	get menu() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set menu(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Components\Modal.svelte generated by Svelte v3.44.3 */

    const file$3 = "src\\Components\\Modal.svelte";
    const get_modal_body_slot_changes = dirty => ({});
    const get_modal_body_slot_context = ctx => ({});

    function create_fragment$3(ctx) {
    	let div5;
    	let div4;
    	let div3;
    	let div0;
    	let h5;
    	let t1;
    	let button0;
    	let t2;
    	let div1;
    	let t3;
    	let div2;
    	let button1;
    	let t5;
    	let button2;
    	let current;
    	const modal_body_slot_template = /*#slots*/ ctx[1].modal_body;
    	const modal_body_slot = create_slot(modal_body_slot_template, ctx, /*$$scope*/ ctx[0], get_modal_body_slot_context);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			h5 = element("h5");
    			h5.textContent = "XML";
    			t1 = space();
    			button0 = element("button");
    			t2 = space();
    			div1 = element("div");
    			if (modal_body_slot) modal_body_slot.c();
    			t3 = space();
    			div2 = element("div");
    			button1 = element("button");
    			button1.textContent = "CANCEL";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "DONE";
    			attr_dev(h5, "class", "modal-title");
    			attr_dev(h5, "id", "exampleModalLabel");
    			add_location(h5, file$3, 4, 16, 270);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn-close");
    			attr_dev(button0, "data-bs-dismiss", "modal");
    			attr_dev(button0, "aria-label", "Close");
    			add_location(button0, file$3, 5, 16, 343);
    			attr_dev(div0, "class", "modal-header border-0");
    			add_location(div0, file$3, 3, 12, 217);
    			attr_dev(div1, "name", "modal_body");
    			attr_dev(div1, "class", "modal-body");
    			attr_dev(div1, "id", "xml_data");
    			add_location(div1, file$3, 7, 12, 462);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-secondary");
    			attr_dev(button1, "data-bs-dismiss", "modal");
    			add_location(button1, file$3, 11, 16, 654);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-primary");
    			add_location(button2, file$3, 12, 16, 759);
    			attr_dev(div2, "class", "modal-footer border-0");
    			add_location(div2, file$3, 10, 12, 601);
    			attr_dev(div3, "class", "modal-content");
    			add_location(div3, file$3, 2, 8, 176);
    			attr_dev(div4, "class", "modal-dialog modal-dialog-centered");
    			add_location(div4, file$3, 1, 4, 118);
    			attr_dev(div5, "class", "modal fade");
    			attr_dev(div5, "id", "exampleModal");
    			attr_dev(div5, "tabindex", "-1");
    			attr_dev(div5, "aria-labelledby", "exampleModalLabel");
    			attr_dev(div5, "aria-hidden", "true");
    			add_location(div5, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div0);
    			append_dev(div0, h5);
    			append_dev(div0, t1);
    			append_dev(div0, button0);
    			append_dev(div3, t2);
    			append_dev(div3, div1);

    			if (modal_body_slot) {
    				modal_body_slot.m(div1, null);
    			}

    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, button1);
    			append_dev(div2, t5);
    			append_dev(div2, button2);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (modal_body_slot) {
    				if (modal_body_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						modal_body_slot,
    						modal_body_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(modal_body_slot_template, /*$$scope*/ ctx[0], dirty, get_modal_body_slot_changes),
    						get_modal_body_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal_body_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal_body_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if (modal_body_slot) modal_body_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, ['modal_body']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* clsSMFill\FillInTheBlanks.svelte generated by Svelte v3.44.3 */
    const file$2 = "clsSMFill\\FillInTheBlanks.svelte";

    function create_fragment$2(ctx) {
    	let div6;
    	let h60;
    	let t1;
    	let div0;
    	let t3;
    	let h61;
    	let t5;
    	let div1;
    	let t7;
    	let div3;
    	let div2;
    	let t8;
    	let div5;
    	let h62;
    	let t10;
    	let div4;
    	let t12;
    	let div16;
    	let div15;
    	let div14;
    	let div7;
    	let h5;
    	let t14;
    	let button0;
    	let t15;
    	let div12;
    	let div8;
    	let input0;
    	let t16;
    	let label0;
    	let t18;
    	let div9;
    	let input1;
    	let t19;
    	let label1;
    	let t21;
    	let input2;
    	let input2_id_value;
    	let t22;
    	let div10;
    	let input3;
    	let t23;
    	let label2;
    	let t25;
    	let input4;
    	let t26;
    	let div11;
    	let h63;
    	let t28;
    	let p0;
    	let t30;
    	let p1;
    	let t32;
    	let div13;
    	let button1;
    	let t34;
    	let button2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			h60 = element("h6");
    			h60.textContent = "Title";
    			t1 = space();
    			div0 = element("div");
    			div0.textContent = "Place Your Text Here";
    			t3 = space();
    			h61 = element("h6");
    			h61.textContent = "Stem";
    			t5 = space();
    			div1 = element("div");
    			div1.textContent = "Place Your Text Here";
    			t7 = space();
    			div3 = element("div");
    			div2 = element("div");
    			t8 = space();
    			div5 = element("div");
    			h62 = element("h6");
    			h62.textContent = "Remediation";
    			t10 = space();
    			div4 = element("div");
    			div4.textContent = "Place Your Text Here";
    			t12 = space();
    			div16 = element("div");
    			div15 = element("div");
    			div14 = element("div");
    			div7 = element("div");
    			h5 = element("h5");
    			h5.textContent = "XML";
    			t14 = space();
    			button0 = element("button");
    			t15 = space();
    			div12 = element("div");
    			div8 = element("div");
    			input0 = element("input");
    			t16 = space();
    			label0 = element("label");
    			label0.textContent = "Code";
    			t18 = space();
    			div9 = element("div");
    			input1 = element("input");
    			t19 = space();
    			label1 = element("label");
    			label1.textContent = "Numeric";
    			t21 = space();
    			input2 = element("input");
    			t22 = space();
    			div10 = element("div");
    			input3 = element("input");
    			t23 = space();
    			label2 = element("label");
    			label2.textContent = "Enable Style";
    			t25 = space();
    			input4 = element("input");
    			t26 = space();
    			div11 = element("div");
    			h63 = element("h6");
    			h63.textContent = "*Note :";
    			t28 = space();
    			p0 = element("p");
    			p0.textContent = "1. To include multiple correct answers, type the\r\n                            answers and separate them with a comma (,). Please\r\n                            do not include any space. Now, go back to the\r\n                            Settings and select Multiple Correct Answers from\r\n                            the drop-down";
    			t30 = space();
    			p1 = element("p");
    			p1.textContent = "2. Use #cm for comma (e.g., 5,000 as 5#cm000,\r\n                            function(a,b) as function(a#cmb)).";
    			t32 = space();
    			div13 = element("div");
    			button1 = element("button");
    			button1.textContent = "CANCEL";
    			t34 = space();
    			button2 = element("button");
    			button2.textContent = "DONE";
    			attr_dev(h60, "class", "m-3 bg-light p-1");
    			add_location(h60, file$2, 10, 4, 313);
    			attr_dev(div0, "class", "mb-3 py-2 pl-3 mx-3 border-bottom");
    			attr_dev(div0, "contenteditable", "true");
    			set_style(div0, "outline", "none");
    			add_location(div0, file$2, 11, 4, 358);
    			attr_dev(h61, "class", "m-3 bg-light p-1");
    			add_location(h61, file$2, 14, 4, 500);
    			attr_dev(div1, "class", "mb-3 py-2 pl-3 mx-3 border-bottom");
    			attr_dev(div1, "contenteditable", "true");
    			set_style(div1, "outline", "none");
    			add_location(div1, file$2, 15, 4, 544);
    			attr_dev(div2, "class", "bg-white px-2 mt-2 pt-3");
    			set_style(div2, "outline", "none");
    			attr_dev(div2, "contenteditable", "true");
    			attr_dev(div2, "id", "editor");
    			add_location(div2, file$2, 19, 8, 750);
    			attr_dev(div3, "class", "authoring_view mt-3 bg-sky_blue pt-4 px-1");
    			add_location(div3, file$2, 18, 4, 685);
    			attr_dev(h62, "class", "m-3 bg-light p-1");
    			add_location(h62, file$2, 25, 8, 957);
    			attr_dev(div4, "class", "mb-5 py-2 mx-3 pl-3");
    			attr_dev(div4, "contenteditable", "true");
    			set_style(div4, "outline", "none");
    			add_location(div4, file$2, 26, 8, 1012);
    			attr_dev(div5, "class", "border-bottom");
    			add_location(div5, file$2, 24, 4, 920);
    			attr_dev(div6, "class", "container bg-white");
    			add_location(div6, file$2, 9, 0, 275);
    			attr_dev(h5, "class", "modal-title");
    			attr_dev(h5, "id", "exampleModalLabel1");
    			add_location(h5, file$2, 36, 20, 1465);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn-close");
    			attr_dev(button0, "data-bs-dismiss", "modal");
    			attr_dev(button0, "aria-label", "Close");
    			add_location(button0, file$2, 37, 20, 1543);
    			attr_dev(div7, "class", "modal-header border-0");
    			add_location(div7, file$2, 35, 16, 1408);
    			attr_dev(input0, "class", "form-check-input");
    			attr_dev(input0, "type", "checkbox");
    			input0.value = "";
    			attr_dev(input0, "id", "flexCheckDefault1");
    			add_location(input0, file$2, 41, 24, 1792);
    			attr_dev(label0, "class", "form-check-label");
    			attr_dev(label0, "for", "flexCheckDefault1");
    			add_location(label0, file$2, 42, 24, 1899);
    			attr_dev(div8, "class", "form-check d-inline-block float-left");
    			add_location(div8, file$2, 40, 20, 1716);
    			attr_dev(input1, "class", "form-check-input");
    			attr_dev(input1, "type", "checkbox");
    			input1.value = "";
    			attr_dev(input1, "id", "flexCheckDefault2");
    			add_location(input1, file$2, 47, 24, 2176);
    			attr_dev(label1, "class", "form-check-label");
    			attr_dev(label1, "for", "flexCheckDefault2");
    			add_location(label1, file$2, 48, 24, 2284);
    			attr_dev(div9, "class", "form-check d-inline-block float-right");
    			set_style(div9, "margin-left", "20%");
    			add_location(div9, file$2, 46, 20, 2073);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "id", input2_id_value = "set_xml" + /*index*/ ctx[2]);
    			attr_dev(input2, "class", "form-control my-3");
    			input2.value = /*set_value*/ ctx[1];
    			attr_dev(input2, "placeholder", "Write your correct answer");
    			add_location(input2, file$2, 50, 20, 2405);
    			attr_dev(input3, "class", "form-check-input");
    			attr_dev(input3, "type", "checkbox");
    			input3.value = "";
    			attr_dev(input3, "id", "flexCheckDefault2");
    			add_location(input3, file$2, 52, 24, 2631);
    			attr_dev(label2, "class", "form-check-label");
    			attr_dev(label2, "for", "flexCheckDefault2");
    			add_location(label2, file$2, 53, 24, 2738);
    			attr_dev(div10, "class", "form-check d-inline-block float-right");
    			add_location(div10, file$2, 51, 20, 2554);
    			attr_dev(input4, "type", "text");
    			attr_dev(input4, "class", "form-control my-3");
    			attr_dev(input4, "placeholder", "Custom Style");
    			input4.disabled = "disabled";
    			add_location(input4, file$2, 55, 20, 2864);
    			add_location(h63, file$2, 57, 24, 3056);
    			add_location(p0, file$2, 58, 24, 3098);
    			add_location(p1, file$2, 65, 24, 3512);
    			attr_dev(div11, "class", "text-danger");
    			set_style(div11, "font-size", "13px");
    			add_location(div11, file$2, 56, 20, 2980);
    			attr_dev(div12, "class", "modal-body");
    			add_location(div12, file$2, 39, 16, 1670);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-secondary");
    			attr_dev(button1, "data-bs-dismiss", "modal");
    			add_location(button1, file$2, 72, 20, 3811);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "btn btn-primary");
    			attr_dev(button2, "data-bs-dismiss", "modal");
    			add_location(button2, file$2, 73, 20, 3920);
    			attr_dev(div13, "class", "modal-footer border-0");
    			add_location(div13, file$2, 71, 16, 3754);
    			attr_dev(div14, "class", "modal-content");
    			add_location(div14, file$2, 34, 12, 1363);
    			attr_dev(div15, "class", "modal-dialog modal-dialog-centered");
    			add_location(div15, file$2, 33, 8, 1301);
    			attr_dev(div16, "class", "modal fade");
    			attr_dev(div16, "id", "Modal_data");
    			attr_dev(div16, "tabindex", "-1");
    			attr_dev(div16, "aria-labelledby", "modal");
    			attr_dev(div16, "aria-hidden", "true");
    			add_location(div16, file$2, 32, 4, 1193);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, h60);
    			append_dev(div6, t1);
    			append_dev(div6, div0);
    			append_dev(div6, t3);
    			append_dev(div6, h61);
    			append_dev(div6, t5);
    			append_dev(div6, div1);
    			append_dev(div6, t7);
    			append_dev(div6, div3);
    			append_dev(div3, div2);
    			div2.innerHTML = /*auth_xml*/ ctx[0];
    			append_dev(div6, t8);
    			append_dev(div6, div5);
    			append_dev(div5, h62);
    			append_dev(div5, t10);
    			append_dev(div5, div4);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, div16, anchor);
    			append_dev(div16, div15);
    			append_dev(div15, div14);
    			append_dev(div14, div7);
    			append_dev(div7, h5);
    			append_dev(div7, t14);
    			append_dev(div7, button0);
    			append_dev(div14, t15);
    			append_dev(div14, div12);
    			append_dev(div12, div8);
    			append_dev(div8, input0);
    			append_dev(div8, t16);
    			append_dev(div8, label0);
    			append_dev(div12, t18);
    			append_dev(div12, div9);
    			append_dev(div9, input1);
    			append_dev(div9, t19);
    			append_dev(div9, label1);
    			append_dev(div12, t21);
    			append_dev(div12, input2);
    			append_dev(div12, t22);
    			append_dev(div12, div10);
    			append_dev(div10, input3);
    			append_dev(div10, t23);
    			append_dev(div10, label2);
    			append_dev(div12, t25);
    			append_dev(div12, input4);
    			append_dev(div12, t26);
    			append_dev(div12, div11);
    			append_dev(div11, h63);
    			append_dev(div11, t28);
    			append_dev(div11, p0);
    			append_dev(div11, t30);
    			append_dev(div11, p1);
    			append_dev(div14, t32);
    			append_dev(div14, div13);
    			append_dev(div13, button1);
    			append_dev(div13, t34);
    			append_dev(div13, button2);

    			if (!mounted) {
    				dispose = listen_dev(button2, "click", /*click_handler*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*auth_xml*/ 1) div2.innerHTML = /*auth_xml*/ ctx[0];
    			if (dirty & /*index*/ 4 && input2_id_value !== (input2_id_value = "set_xml" + /*index*/ ctx[2])) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty & /*set_value*/ 2 && input2.value !== /*set_value*/ ctx[1]) {
    				prop_dev(input2, "value", /*set_value*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(div16);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FillInTheBlanks', slots, []);
    	const dispatch = createEventDispatcher();
    	let { auth_xml } = $$props;
    	let { set_value } = $$props;
    	let { index } = $$props;
    	const writable_props = ['auth_xml', 'set_value', 'index'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FillInTheBlanks> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => dispatch("update", index);

    	$$self.$$set = $$props => {
    		if ('auth_xml' in $$props) $$invalidate(0, auth_xml = $$props.auth_xml);
    		if ('set_value' in $$props) $$invalidate(1, set_value = $$props.set_value);
    		if ('index' in $$props) $$invalidate(2, index = $$props.index);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		auth_xml,
    		set_value,
    		index
    	});

    	$$self.$inject_state = $$props => {
    		if ('auth_xml' in $$props) $$invalidate(0, auth_xml = $$props.auth_xml);
    		if ('set_value' in $$props) $$invalidate(1, set_value = $$props.set_value);
    		if ('index' in $$props) $$invalidate(2, index = $$props.index);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [auth_xml, set_value, index, dispatch, click_handler];
    }

    class FillInTheBlanks extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { auth_xml: 0, set_value: 1, index: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FillInTheBlanks",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*auth_xml*/ ctx[0] === undefined && !('auth_xml' in props)) {
    			console.warn("<FillInTheBlanks> was created without expected prop 'auth_xml'");
    		}

    		if (/*set_value*/ ctx[1] === undefined && !('set_value' in props)) {
    			console.warn("<FillInTheBlanks> was created without expected prop 'set_value'");
    		}

    		if (/*index*/ ctx[2] === undefined && !('index' in props)) {
    			console.warn("<FillInTheBlanks> was created without expected prop 'index'");
    		}
    	}

    	get auth_xml() {
    		throw new Error("<FillInTheBlanks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set auth_xml(value) {
    		throw new Error("<FillInTheBlanks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get set_value() {
    		throw new Error("<FillInTheBlanks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set set_value(value) {
    		throw new Error("<FillInTheBlanks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get index() {
    		throw new Error("<FillInTheBlanks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set index(value) {
    		throw new Error("<FillInTheBlanks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    class X2JS {
        config = {};
        VERSION = "1.2.0";

        DOMNodeTypes = {
            ELEMENT_NODE: 1,
            TEXT_NODE: 3,
            CDATA_SECTION_NODE: 4,
            COMMENT_NODE: 8,
            DOCUMENT_NODE: 9
        }
        constructor() {
            this.initConfigDefaults();
            this.initRequiredPolyfills();
        }
        initConfigDefaults() {
            if (this.config.escapeMode === undefined) {
                this.config.escapeMode = true;
            }

            this.config.attributePrefix = this.config.attributePrefix || "_";
            this.config.arrayAccessForm = this.config.arrayAccessForm || "none";
            this.config.emptyNodeForm = this.config.emptyNodeForm || "text";

            if (this.config.enableToStringFunc === undefined) {
                this.config.enableToStringFunc = true;
            }
            this.config.arrayAccessFormPaths = this.config.arrayAccessFormPaths || [];
            if (this.config.skipEmptyTextNodesForObj === undefined) {
                this.config.skipEmptyTextNodesForObj = true;
            }
            if (this.config.stripWhitespaces === undefined) {
                this.config.stripWhitespaces = true;
            }
            this.config.datetimeAccessFormPaths = this.config.datetimeAccessFormPaths || [];

            if (this.config.useDoubleQuotes === undefined) {
                this.config.useDoubleQuotes = false;
            }

            this.config.xmlElementsFilter = this.config.xmlElementsFilter || [];
            this.config.jsonPropertiesFilter = this.config.jsonPropertiesFilter || [];

            if (this.config.keepCData === undefined) {
                this.config.keepCData = false;
            }
        }

        initRequiredPolyfills() {}

        getNodeLocalName(node) {
            var nodeLocalName = node.localName;
            if (nodeLocalName == null) // Yeah, this is IE!! 
                nodeLocalName = node.baseName;
            if (nodeLocalName == null || nodeLocalName == "") // =="" is IE too
                nodeLocalName = node.nodeName;
            return nodeLocalName;
        }

        getNodePrefix(node) {
            return node.prefix;
        }

        escapeXmlChars(str) {
            if (typeof(str) == "string")
                return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
            else
                return str;
        }

        unescapeXmlChars(str) {
            return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
        }

        checkInStdFiltersArrayForm(stdFiltersArrayForm, obj, name, path) {
            var idx = 0;
            for (; idx < stdFiltersArrayForm.length; idx++) {
                var filterPath = stdFiltersArrayForm[idx];
                if (typeof filterPath === "string") {
                    if (filterPath == path)
                        break;
                } else
                if (filterPath instanceof RegExp) {
                    if (filterPath.test(path))
                        break;
                } else
                if (typeof filterPath === "function") {
                    if (filterPath(obj, name, path))
                        break;
                }
            }
            return idx != stdFiltersArrayForm.length;
        }

        toArrayAccessForm(obj, childName, path) {
            switch (this.config.arrayAccessForm) {
                case "property":
                    if (!(obj[childName] instanceof Array))
                        obj[childName + "_asArray"] = [obj[childName]];
                    else
                        obj[childName + "_asArray"] = obj[childName];
                    break;
                    /*case "none":
                    	break;*/
            }

            if (!(obj[childName] instanceof Array) && this.config.arrayAccessFormPaths.length > 0) {
                if (this.checkInStdFiltersArrayForm(this.config.arrayAccessFormPaths, obj, childName, path)) {
                    obj[childName] = [obj[childName]];
                }
            }
        }

        fromXmlDateTime(prop) {
            // Implementation based up on http://stackoverflow.com/questions/8178598/xml-datetime-to-javascript-date-object
            // Improved to support full spec and optional parts
            var bits = prop.split(/[-T:+Z]/g);

            var d = new Date(bits[0], bits[1] - 1, bits[2]);
            var secondBits = bits[5].split("\.");
            d.setHours(bits[3], bits[4], secondBits[0]);
            if (secondBits.length > 1)
                d.setMilliseconds(secondBits[1]);

            // Get supplied time zone offset in minutes
            if (bits[6] && bits[7]) {
                var offsetMinutes = bits[6] * 60 + Number(bits[7]);
                var sign = /\d\d-\d\d:\d\d$/.test(prop) ? '-' : '+';

                // Apply the sign
                offsetMinutes = 0 + (sign == '-' ? -1 * offsetMinutes : offsetMinutes);

                // Apply offset and local timezone
                d.setMinutes(d.getMinutes() - offsetMinutes - d.getTimezoneOffset());
            } else
            if (prop.indexOf("Z", prop.length - 1) !== -1) {
                d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()));
            }

            // d is now a local time equivalent to the supplied time
            return d;
        }

        checkFromXmlDateTimePaths(value, childName, fullPath) {
            if (this.config.datetimeAccessFormPaths.length > 0) {
                var path = fullPath.split("\.#")[0];
                if (this.checkInStdFiltersArrayForm(this.config.datetimeAccessFormPaths, value, childName, path)) {
                    return this.fromXmlDateTime(value);
                } else
                    return value;
            } else
                return value;
        }

        checkXmlElementsFilter(obj, childType, childName, childPath) {
            if (childType == this.DOMNodeTypes.ELEMENT_NODE && this.config.xmlElementsFilter.length > 0) {
                return this.checkInStdFiltersArrayForm(this.config.xmlElementsFilter, obj, childName, childPath);
            } else
                return true;
        }

        parseDOMChildren(node, path) {
            if (node.nodeType == this.DOMNodeTypes.DOCUMENT_NODE) {
                var result = new Object;
                var nodeChildren = node.childNodes;
                // Alternative for firstElementChild which is not supported in some environments
                for (var cidx = 0; cidx < nodeChildren.length; cidx++) {
                    var child = nodeChildren.item(cidx);
                    if (child.nodeType == this.DOMNodeTypes.ELEMENT_NODE) {
                        var childName = this.getNodeLocalName(child);
                        result[childName] = this.parseDOMChildren(child, childName);
                    }
                }
                return result;
            } else
            if (node.nodeType == this.DOMNodeTypes.ELEMENT_NODE) {
                var result = new Object;
                result.__cnt = 0;

                var nodeChildren = node.childNodes;

                // Children nodes
                for (var cidx = 0; cidx < nodeChildren.length; cidx++) {
                    var child = nodeChildren.item(cidx); // nodeChildren[cidx];
                    var childName = this.getNodeLocalName(child);

                    if (child.nodeType != this.DOMNodeTypes.COMMENT_NODE) {
                        var childPath = path + "." + childName;
                        if (this.checkXmlElementsFilter(result, child.nodeType, childName, childPath)) {
                            result.__cnt++;
                            if (result[childName] == null) {
                                result[childName] = this.parseDOMChildren(child, childPath);
                                this.toArrayAccessForm(result, childName, childPath);
                            } else {
                                if (result[childName] != null) {
                                    if (!(result[childName] instanceof Array)) {
                                        result[childName] = [result[childName]];
                                        this.toArrayAccessForm(result, childName, childPath);
                                    }
                                }
                                (result[childName])[result[childName].length] = this.parseDOMChildren(child, childPath);
                            }
                        }
                    }
                }

                // Attributes
                for (var aidx = 0; aidx < node.attributes.length; aidx++) {
                    var attr = node.attributes.item(aidx); // [aidx];
                    result.__cnt++;
                    result[this.config.attributePrefix + attr.name] = attr.value;
                }

                // Node namespace prefix
                var nodePrefix = this.getNodePrefix(node);
                if (nodePrefix != null && nodePrefix != "") {
                    result.__cnt++;
                    result.__prefix = nodePrefix;
                }

                if (result["#text"] != null) {
                    result.__text = result["#text"];
                    if (result.__text instanceof Array) {
                        result.__text = result.__text.join("\n");
                    }
                    //if(this.config.escapeMode)
                    //	result.__text = this.unescapeXmlChars(result.__text);
                    if (this.config.stripWhitespaces)
                        result.__text = result.__text.trim();
                    delete result["#text"];
                    if (this.config.arrayAccessForm == "property")
                        delete result["#text_asArray"];
                    result.__text = this.checkFromXmlDateTimePaths(result.__text, childName, path + "." + childName);
                }
                if (result["#cdata-section"] != null) {
                    result.__cdata = result["#cdata-section"];
                    delete result["#cdata-section"];
                    if (this.config.arrayAccessForm == "property")
                        delete result["#cdata-section_asArray"];
                }

                if (result.__cnt == 0 && this.config.emptyNodeForm == "text") {
                    result = '';
                } else
                if (result.__cnt == 1 && result.__text != null) {
                    result = result.__text;
                } else
                if (result.__cnt == 1 && result.__cdata != null && !this.config.keepCData) {
                    result = result.__cdata;
                } else
                if (result.__cnt > 1 && result.__text != null && this.config.skipEmptyTextNodesForObj) {
                    if ((this.config.stripWhitespaces && result.__text == "") || (result.__text.trim() == "")) {
                        delete result.__text;
                    }
                }
                delete result.__cnt;

                if (this.config.enableToStringFunc && (result.__text != null || result.__cdata != null)) {
                    result.toString = function() {
                        return (this.__text != null ? this.__text : '') + (this.__cdata != null ? this.__cdata : '');
                    };
                }

                return result;
            } else
            if (node.nodeType == this.DOMNodeTypes.TEXT_NODE || node.nodeType == this.DOMNodeTypes.CDATA_SECTION_NODE) {
                return node.nodeValue;
            }
        }

        startTag(jsonObj, element, attrList, closed) {
            var resultStr = "<" + ((jsonObj != null && jsonObj.__prefix != null) ? (jsonObj.__prefix + ":") : "") + element;
            if (attrList != null) {
                for (var aidx = 0; aidx < attrList.length; aidx++) {
                    var attrName = attrList[aidx];
                    var attrVal = jsonObj[attrName];
                    if (this.config.escapeMode)
                        attrVal = this.escapeXmlChars(attrVal);
                    resultStr += " " + attrName.substr(this.config.attributePrefix.length) + "=";
                    if (this.config.useDoubleQuotes)
                        resultStr += '"' + attrVal + '"';
                    else
                        resultStr += "'" + attrVal + "'";
                }
            }
            if (!closed)
                resultStr += ">";
            else
                resultStr += "/>";
            return resultStr;
        }

        endTag(jsonObj, elementName) {
            return "</" + (jsonObj.__prefix != null ? (jsonObj.__prefix + ":") : "") + elementName + ">";
        }

        endsWith(str, suffix) {
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        }

        jsonXmlSpecialElem(jsonObj, jsonObjField) {
            if ((this.config.arrayAccessForm == "property" && this.endsWith(jsonObjField.toString(), ("_asArray"))) ||
                jsonObjField.toString().indexOf(this.config.attributePrefix) == 0 ||
                jsonObjField.toString().indexOf("__") == 0 ||
                (jsonObj[jsonObjField] instanceof Function))
                return true;
            else
                return false;
        }

        jsonXmlElemCount(jsonObj) {
            var elementsCnt = 0;
            if (jsonObj instanceof Object) {
                for (var it in jsonObj) {
                    if (this.jsonXmlSpecialElem(jsonObj, it))
                        continue;
                    elementsCnt++;
                }
            }
            return elementsCnt;
        }

        checkJsonObjPropertiesFilter(jsonObj, propertyName, jsonObjPath) {
            return this.config.jsonPropertiesFilter.length == 0 ||
                jsonObjPath == "" ||
                this.checkInStdFiltersArrayForm(this.config.jsonPropertiesFilter, jsonObj, propertyName, jsonObjPath);
        }

        parseJSONAttributes(jsonObj) {
            var attrList = [];
            if (jsonObj instanceof Object) {
                for (var ait in jsonObj) {
                    if (ait.toString().indexOf("__") == -1 && ait.toString().indexOf(this.config.attributePrefix) == 0) {
                        attrList.push(ait);
                    }
                }
            }
            return attrList;
        }

        parseJSONTextAttrs(jsonTxtObj) {
            var result = "";

            if (jsonTxtObj.__cdata != null) {
                result += "<![CDATA[" + jsonTxtObj.__cdata + "]]>";
            }

            if (jsonTxtObj.__text != null) {
                if (this.config.escapeMode)
                    result += this.escapeXmlChars(jsonTxtObj.__text);
                else
                    result += jsonTxtObj.__text;
            }
            return result;
        }

        parseJSONTextObject(jsonTxtObj) {
            var result = "";

            if (jsonTxtObj instanceof Object) {
                result += this.parseJSONTextAttrs(jsonTxtObj);
            } else
            if (jsonTxtObj != null) {
                if (this.config.escapeMode)
                    result += this.escapeXmlChars(jsonTxtObj);
                else
                    result += jsonTxtObj;
            }

            return result;
        }

        getJsonPropertyPath(jsonObjPath, jsonPropName) {
            if (jsonObjPath === "") {
                return jsonPropName;
            } else
                return jsonObjPath + "." + jsonPropName;
        }

        parseJSONArray(jsonArrRoot, jsonArrObj, attrList, jsonObjPath) {
            var result = "";
            if (jsonArrRoot.length == 0) {
                result += this.startTag(jsonArrRoot, jsonArrObj, attrList, true);
            } else {
                for (var arIdx = 0; arIdx < jsonArrRoot.length; arIdx++) {
                    result += this.startTag(jsonArrRoot[arIdx], jsonArrObj, this.parseJSONAttributes(jsonArrRoot[arIdx]), false);
                    result += this.parseJSONObject(jsonArrRoot[arIdx], this.getJsonPropertyPath(jsonObjPath, jsonArrObj));
                    result += this.endTag(jsonArrRoot[arIdx], jsonArrObj);
                }
            }
            return result;
        }

        parseJSONObject(jsonObj, jsonObjPath) {
            var result = "";

            var elementsCnt = this.jsonXmlElemCount(jsonObj);

            if (elementsCnt > 0) {
                for (var it in jsonObj) {

                    if (this.jsonXmlSpecialElem(jsonObj, it) || (jsonObjPath != "" && !this.checkJsonObjPropertiesFilter(jsonObj, it, this.getJsonPropertyPath(jsonObjPath, it))))
                        continue;

                    var subObj = jsonObj[it];

                    var attrList = this.parseJSONAttributes(subObj);

                    if (subObj == null || subObj == undefined) {
                        result += this.startTag(subObj, it, attrList, true);
                    } else
                    if (subObj instanceof Object) {

                        if (subObj instanceof Array) {
                            result += this.parseJSONArray(subObj, it, attrList, jsonObjPath);
                        } else if (subObj instanceof Date) {
                            result += this.startTag(subObj, it, attrList, false);
                            result += subObj.toISOString();
                            result += this.endTag(subObj, it);
                        } else {
                            var subObjElementsCnt = this.jsonXmlElemCount(subObj);
                            if (subObjElementsCnt > 0 || subObj.__text != null || subObj.__cdata != null) {
                                result += this.startTag(subObj, it, attrList, false);
                                result += this.parseJSONObject(subObj, this.getJsonPropertyPath(jsonObjPath, it));
                                result += this.endTag(subObj, it);
                            } else {
                                result += this.startTag(subObj, it, attrList, true);
                            }
                        }
                    } else {
                        result += this.startTag(subObj, it, attrList, false);
                        result += this.parseJSONTextObject(subObj);
                        result += this.endTag(subObj, it);
                    }
                }
            }
            result += this.parseJSONTextObject(jsonObj);

            return result;
        }

        parseXmlString(xmlDocStr) {
            var isIEParser = window.ActiveXObject || "ActiveXObject" in window;
            if (xmlDocStr === undefined) {
                return null;
            }
            var xmlDoc;
            if (window.DOMParser) {
                var parser = new window.DOMParser();
                var parsererrorNS = null;
                // IE9+ now is here
                if (!isIEParser) {
                    try {
                        parsererrorNS = parser.parseFromString("INVALID", "text/xml").getElementsByTagName("parsererror")[0].namespaceURI;
                    } catch (err) {
                        parsererrorNS = null;
                    }
                }
                try {
                    xmlDoc = parser.parseFromString(xmlDocStr, "text/xml");
                    if (parsererrorNS != null && xmlDoc.getElementsByTagNameNS(parsererrorNS, "parsererror").length > 0) {
                        //throw new Error('Error parsing XML: '+xmlDocStr);
                        xmlDoc = null;
                    }
                } catch (err) {
                    xmlDoc = null;
                }
            } else {
                // IE :(
                if (xmlDocStr.indexOf("<?") == 0) {
                    xmlDocStr = xmlDocStr.substr(xmlDocStr.indexOf("?>") + 2);
                }
                xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = "false";
                xmlDoc.loadXML(xmlDocStr);
            }
            return xmlDoc;
        };

        asArray(prop) {
            if (prop === undefined || prop == null)
                return [];
            else
            if (prop instanceof Array)
                return prop;
            else
                return [prop];
        };

        toXmlDateTime(dt) {
            if (dt instanceof Date)
                return dt.toISOString();
            else
            if (typeof(dt) === 'number')
                return new Date(dt).toISOString();
            else
                return null;
        };

        asDateTime(prop) {
            if (typeof(prop) == "string") {
                return this.fromXmlDateTime(prop);
            } else
                return prop;
        };

        xml2json(xmlDoc) {
            return this.parseDOMChildren(xmlDoc);
        };

        xml_str2json(xmlDocStr) {
            var xmlDoc = this.parseXmlString(xmlDocStr);
            if (xmlDoc != null)
                return this.xml2json(xmlDoc);
            else
                return null;
        };

        json2xml_str(jsonObj) {
            return this.parseJSONObject(jsonObj, "");
        };

        json2xml(jsonObj) {
            var xmlDocStr = this.json2xml_str(jsonObj);
            return this.parseXmlString(xmlDocStr);
        };

        getVersion() {
            return this.VERSION;
        }
    }

    /* helper\HelperAI.svelte generated by Svelte v3.44.3 */

    function XMLToJSON(myXml) {
    	//var myXml = xml;
    	myXml = myXml.replace(/<\!--\[CDATA\[/g, "<![CDATA[").replace(/\]\]-->/g, "]]>");

    	let x2js = new X2JS({ useDoubleQuotes: true });
    	let newXml = JSON.stringify(x2js.xml_str2json(myXml));
    	newXml = newXml.replace("SMXML", "smxml");
    	newXml = JSON.parse(newXml);
    	return newXml;
    }

    /* clsSMFill\FillInTheBlanksPreview.svelte generated by Svelte v3.44.3 */
    const file$1 = "clsSMFill\\FillInTheBlanksPreview.svelte";

    // (82:8) {#if checked}
    function create_if_block$1(ctx) {
    	let center;
    	let div;
    	let input0;
    	let t0;
    	let label0;
    	let t2;
    	let input1;
    	let t3;
    	let label1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			center = element("center");
    			div = element("div");
    			input0 = element("input");
    			t0 = space();
    			label0 = element("label");
    			label0.textContent = "Correct Answer";
    			t2 = space();
    			input1 = element("input");
    			t3 = space();
    			label1 = element("label");
    			label1.textContent = "Your Answer";
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "class", "btn-check");
    			attr_dev(input0, "name", "btnradio");
    			attr_dev(input0, "id", "btnradio1");
    			add_location(input0, file$1, 84, 20, 3831);
    			attr_dev(label0, "class", "btn btn-outline-primary");
    			attr_dev(label0, "for", "btnradio1");
    			add_location(label0, file$1, 85, 20, 3922);
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "class", "btn-check");
    			attr_dev(input1, "name", "btnradio");
    			attr_dev(input1, "id", "btnradio2");
    			input1.checked = true;
    			add_location(input1, file$1, 86, 20, 4082);
    			attr_dev(label1, "class", "btn btn-outline-primary");
    			attr_dev(label1, "for", "btnradio2");
    			add_location(label1, file$1, 87, 20, 4182);
    			attr_dev(div, "class", "btn-group text-center m-auto");
    			attr_dev(div, "role", "group");
    			attr_dev(div, "aria-label", "Basic radio toggle button group");
    			add_location(div, file$1, 83, 16, 3709);
    			add_location(center, file$1, 82, 12, 3683);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, center, anchor);
    			append_dev(center, div);
    			append_dev(div, input0);
    			append_dev(div, t0);
    			append_dev(div, label0);
    			append_dev(div, t2);
    			append_dev(div, input1);
    			append_dev(div, t3);
    			append_dev(div, label1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(label0, "click", /*click_handler*/ ctx[4], false, false, false),
    					listen_dev(label1, "click", /*click_handler_1*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(center);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(82:8) {#if checked}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div3;
    	let div2;
    	let t0;
    	let div0;
    	let div0_class_value;
    	let t1;
    	let div1;
    	let p;
    	let if_block = /*checked*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			div1 = element("div");
    			p = element("p");
    			p.textContent = "*Matching is not case sensitive.";
    			attr_dev(div0, "class", div0_class_value = "" + ((/*checked*/ ctx[0] ? "disabled" : "") + " pt-4 px-5"));
    			attr_dev(div0, "id", "preview_xml");
    			add_location(div0, file$1, 91, 8, 4367);
    			add_location(p, file$1, 95, 12, 4562);
    			attr_dev(div1, "class", "text-danger mt-4 px-5");
    			set_style(div1, "font-size", "15px");
    			add_location(div1, file$1, 94, 8, 4488);
    			attr_dev(div2, "class", "authoring_view mt-1 px-1");
    			add_location(div2, file$1, 80, 4, 3608);
    			attr_dev(div3, "class", "container");
    			add_location(div3, file$1, 79, 0, 3579);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			if (if_block) if_block.m(div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, div0);
    			div0.innerHTML = /*auth_xml*/ ctx[1];
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, p);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*checked*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div2, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*auth_xml*/ 2) div0.innerHTML = /*auth_xml*/ ctx[1];
    			if (dirty & /*checked*/ 1 && div0_class_value !== (div0_class_value = "" + ((/*checked*/ ctx[0] ? "disabled" : "") + " pt-4 px-5"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FillInTheBlanksPreview', slots, []);
    	let { default_xml } = $$props;
    	let data_array = [];
    	let input_box = '';
    	let regex = '';
    	let marked = false;
    	let checked = false;
    	let data = XMLToJSON(default_xml)["smxml"]["text"]["__cdata"]; // Here we get the data in human readable format
    	let auth_xml = data;
    	let xml_arr = data.match(/%{[\s\S]*?}%/gm);

    	beforeUpdate(() => {
    		for (let i in xml_arr) {
    			// For extracting the value between %{ANYTEXT}%. i.e. return value ANYTEXT; 
    			data_array[i] = xml_arr[i].replace(/%{/gm, "").replace(/}%/gm, "").replace(/|d}%/gm, "");

    			input_box = `<input type="text" class="input_set text" id="inputBox${i}" correct_ans=${data_array[i]} user_ans='' index=${i} style="width:100px;"/>`;
    			regex = new RegExp(xml_arr[i]);

    			// Here we replace all regex value with input box
    			$$invalidate(1, auth_xml = auth_xml.replace(regex, input_box));
    		}
    	});

    	onMount(() => {
    		// Here we toggle the switch value
    		document.querySelector("#chk_switch").addEventListener('click', function () {
    			$$invalidate(0, checked = !checked);
    		});

    		// Here we set the userans value for all input box
    		document.querySelectorAll(".input_set").forEach(items => {
    			items.addEventListener('input', function (e) {
    				items.setAttribute("user_ans", e.target.value);
    			});
    		});
    	});

    	afterUpdate(() => {
    		if (!checked) {
    			for (let i in xml_arr) {
    				document.querySelector(`#inputBox${i}`).value = document.querySelector(`#inputBox${i}`).getAttribute("user_ans");
    			}
    		}

    		//  Here border generate on Answer checking correct or incorrect
    		if (checked && !marked || checked && document.querySelector("#btnradio2").checked == true) {
    			for (let i in xml_arr) {
    				if (document.querySelector(`#inputBox${i}`).getAttribute('user_ans') == document.querySelector(`#inputBox${i}`).getAttribute('correct_ans')) {
    					document.querySelector(`#inputBox${i}`).style.border = "2px solid green";
    				} else {
    					document.querySelector(`#inputBox${i}`).style.border = "2px solid red";
    				}
    			}
    		} else {
    			for (let i in xml_arr) {
    				document.querySelector(`#inputBox${i}`).style.border = "none";
    			}
    		}
    	});

    	//  In this function we toggle answer between correct and given & Also checking for correct and incorrect
    	function Toggle_Answer(type) {
    		if (type == "correct") {
    			marked = true;

    			for (let i in xml_arr) {
    				let inputModal = document.querySelector(`#inputBox${i}`);
    				inputModal.value = inputModal.getAttribute("correct_ans");
    				inputModal.style.border = "none";
    			}
    		} else {
    			marked = false;

    			for (let i in xml_arr) {
    				let inputModal = document.querySelector(`#inputBox${i}`);
    				inputModal.value = inputModal.getAttribute("user_ans");

    				if (inputModal.getAttribute("correct_ans") == inputModal.getAttribute("user_ans")) {
    					inputModal.style.border = "2px solid green";
    				} else {
    					inputModal.style.border = "2px solid red";
    				}
    			}
    		}
    	}

    	const writable_props = ['default_xml'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FillInTheBlanksPreview> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => Toggle_Answer("correct");
    	const click_handler_1 = () => Toggle_Answer("your");

    	$$self.$$set = $$props => {
    		if ('default_xml' in $$props) $$invalidate(3, default_xml = $$props.default_xml);
    	};

    	$$self.$capture_state = () => ({
    		afterUpdate,
    		beforeUpdate,
    		onMount,
    		XMLToJSON,
    		default_xml,
    		data_array,
    		input_box,
    		regex,
    		marked,
    		checked,
    		data,
    		auth_xml,
    		xml_arr,
    		Toggle_Answer
    	});

    	$$self.$inject_state = $$props => {
    		if ('default_xml' in $$props) $$invalidate(3, default_xml = $$props.default_xml);
    		if ('data_array' in $$props) data_array = $$props.data_array;
    		if ('input_box' in $$props) input_box = $$props.input_box;
    		if ('regex' in $$props) regex = $$props.regex;
    		if ('marked' in $$props) marked = $$props.marked;
    		if ('checked' in $$props) $$invalidate(0, checked = $$props.checked);
    		if ('data' in $$props) data = $$props.data;
    		if ('auth_xml' in $$props) $$invalidate(1, auth_xml = $$props.auth_xml);
    		if ('xml_arr' in $$props) xml_arr = $$props.xml_arr;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [checked, auth_xml, Toggle_Answer, default_xml, click_handler, click_handler_1];
    }

    class FillInTheBlanksPreview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { default_xml: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FillInTheBlanksPreview",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*default_xml*/ ctx[3] === undefined && !('default_xml' in props)) {
    			console.warn("<FillInTheBlanksPreview> was created without expected prop 'default_xml'");
    		}
    	}

    	get default_xml() {
    		throw new Error("<FillInTheBlanksPreview>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set default_xml(value) {
    		throw new Error("<FillInTheBlanksPreview>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* clsSMFill\defaultXML.svelte generated by Svelte v3.44.3 */

    function getDefaultXMl(type) {
    	let xmls = {
    		"editor_item_5.xml": '<smxml type="9" name="FillInTheBlank"><text matchtype="1"><![CDATA[Education then beyond all other devices of %{human}% origin, is the great equalizer of the %{conditions}% of man.]]></text></smxml>',
    		"editor_item_1.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, beyond all other devices of %{a+b|e}% origin, is the great equalizer of the conditions.]]--></text></smxml>',
    		"editor_item_3.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, beyond all other devices of %{data|{"defaultAns":"ds","rows":"2","cols":"10"}}% origin, is the great equalizer of the conditions.]]--></text></smxml>',
    		"editor_item_6.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, beyond all other devices of %{person,*human,+man|s}% origin, is the great equalizer of the %{situations,*conditions|s}% of man.]]--></text></smxml>',
    		"editor_item_7.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, %{beyond|d}% all other devices of %{human|d}% origin, is the great equalizer of the %{conditions|d}% of man.]]--></text></smxml>',
    		"sample": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, %{beyond|d}% all other devices of %{human|d}% origin, is the great equalizer of the %{conditions|d}% of man.]]--></text></smxml>'
    	};

    	return xmls[type];
    }

    /* src\App.svelte generated by Svelte v3.44.3 */
    const file = "src\\App.svelte";

    // (67:18) 
    function create_if_block_1(ctx) {
    	let fillintheblankspreview;
    	let current;

    	fillintheblankspreview = new FillInTheBlanksPreview({
    			props: { default_xml: /*default_xml*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fillintheblankspreview.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fillintheblankspreview, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const fillintheblankspreview_changes = {};
    			if (dirty & /*default_xml*/ 1) fillintheblankspreview_changes.default_xml = /*default_xml*/ ctx[0];
    			fillintheblankspreview.$set(fillintheblankspreview_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fillintheblankspreview.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fillintheblankspreview.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fillintheblankspreview, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(67:18) ",
    		ctx
    	});

    	return block;
    }

    // (65:2) {#if menu==true}
    function create_if_block(ctx) {
    	let fillintheblanks;
    	let current;

    	fillintheblanks = new FillInTheBlanks({
    			props: {
    				index: /*index*/ ctx[4],
    				set_value: /*set_value*/ ctx[3],
    				auth_xml: /*auth_xml*/ ctx[1]
    			},
    			$$inline: true
    		});

    	fillintheblanks.$on("update", function () {
    		if (is_function(/*update_XML*/ ctx[5](/*index*/ ctx[4]))) /*update_XML*/ ctx[5](/*index*/ ctx[4]).apply(this, arguments);
    	});

    	const block = {
    		c: function create() {
    			create_component(fillintheblanks.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fillintheblanks, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const fillintheblanks_changes = {};
    			if (dirty & /*index*/ 16) fillintheblanks_changes.index = /*index*/ ctx[4];
    			if (dirty & /*set_value*/ 8) fillintheblanks_changes.set_value = /*set_value*/ ctx[3];
    			if (dirty & /*auth_xml*/ 2) fillintheblanks_changes.auth_xml = /*auth_xml*/ ctx[1];
    			fillintheblanks.$set(fillintheblanks_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fillintheblanks.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fillintheblanks.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fillintheblanks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(65:2) {#if menu==true}",
    		ctx
    	});

    	return block;
    }

    // (72:2) 
    function create_modal_body_slot(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*default_xml*/ ctx[0]);
    			attr_dev(div, "slot", "modal_body");
    			add_location(div, file, 71, 2, 3262);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*default_xml*/ 1) set_data_dev(t, /*default_xml*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_modal_body_slot.name,
    		type: "slot",
    		source: "(72:2) ",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let header;
    	let t0;
    	let ul;
    	let li0;
    	let a0;
    	let li0_class_value;
    	let t2;
    	let li1;
    	let a1;
    	let li1_class_value;
    	let t4;
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let t5;
    	let modal;
    	let current;
    	let mounted;
    	let dispose;

    	header = new Header({
    			props: { menu: /*menu*/ ctx[2] },
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block, create_if_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*menu*/ ctx[2] == true) return 0;
    		if (!/*menu*/ ctx[2]) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	modal = new Modal({
    			props: {
    				$$slots: { modal_body: [create_modal_body_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(header.$$.fragment);
    			t0 = space();
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Authoring";
    			t2 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "Preview";
    			t4 = space();
    			div = element("div");
    			if (if_block) if_block.c();
    			t5 = space();
    			create_component(modal.$$.fragment);
    			attr_dev(a0, "href", "/");
    			add_location(a0, file, 60, 49, 2851);
    			attr_dev(li0, "class", li0_class_value = /*menu*/ ctx[2] ? "clicked" : "unclicked");
    			add_location(li0, file, 60, 8, 2810);
    			attr_dev(a1, "href", "/");
    			add_location(a1, file, 61, 50, 2980);
    			attr_dev(li1, "class", li1_class_value = !/*menu*/ ctx[2] ? "clicked" : "unclicked");
    			add_location(li1, file, 61, 8, 2938);
    			attr_dev(ul, "class", "container mt-2 border-bottom");
    			attr_dev(ul, "id", "menu");
    			add_location(ul, file, 59, 1, 2750);
    			add_location(div, file, 63, 1, 3067);
    			add_location(main, file, 57, 0, 2724);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(header, main, null);
    			append_dev(main, t0);
    			append_dev(main, ul);
    			append_dev(ul, li0);
    			append_dev(li0, a0);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(li1, a1);
    			append_dev(main, t4);
    			append_dev(main, div);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(div, null);
    			}

    			append_dev(main, t5);
    			mount_component(modal, main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(a0, "click", prevent_default(/*click_handler*/ ctx[6]), false, true, false),
    					listen_dev(a1, "click", prevent_default(/*click_handler_1*/ ctx[7]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const header_changes = {};
    			if (dirty & /*menu*/ 4) header_changes.menu = /*menu*/ ctx[2];
    			header.$set(header_changes);

    			if (!current || dirty & /*menu*/ 4 && li0_class_value !== (li0_class_value = /*menu*/ ctx[2] ? "clicked" : "unclicked")) {
    				attr_dev(li0, "class", li0_class_value);
    			}

    			if (!current || dirty & /*menu*/ 4 && li1_class_value !== (li1_class_value = !/*menu*/ ctx[2] ? "clicked" : "unclicked")) {
    				attr_dev(li1, "class", li1_class_value);
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				} else {
    					if_block = null;
    				}
    			}

    			const modal_changes = {};

    			if (dirty & /*$$scope, default_xml*/ 8193) {
    				modal_changes.$$scope = { dirty, ctx };
    			}

    			modal.$set(modal_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(header);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			destroy_component(modal);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let default_xml = getDefaultXMl("editor_item_5.xml"); //Here we get the XML format data
    	let data = XMLToJSON(default_xml)["smxml"]["text"]["__cdata"]; // Here we get the data in human readable format
    	let xml_arr = data.match(/%{[\s\S]*?}%/gm);
    	let input_data = '';
    	let auth_xml = data;
    	let menu = true;
    	let inputs = '';
    	let regex = '';
    	let set_value;
    	let index = 0;

    	beforeUpdate(() => {
    		for (let i in xml_arr) {
    			// For extracting the value between %{ANYTEXT}%. i.e. return value ANYTEXT; 
    			inputs = xml_arr[i].replace(/%{/gm, "").replace(/|d}%/gm, "").replace(/}%/gm, "");

    			input_data = `<span class="px-5 border border-primary" index=${i} id="input_box${i}" original_key=${inputs}  data-bs-toggle="modal" data-bs-target="#Modal_data"></span>`;
    			regex = new RegExp(xml_arr[i]);

    			// Here we replace all regex value with input_box
    			$$invalidate(1, auth_xml = auth_xml.replace(regex, input_data));
    		}
    	});

    	onMount(() => {
    		for (let i in xml_arr) {
    			document.querySelector(`#input_box${i}`).addEventListener('click', function (e) {
    				$$invalidate(4, index = i);
    				$$invalidate(3, set_value = e.target.getAttribute("original_key"));
    			});
    		}

    		//  Here we update our default XML data after change in editor area
    		document.querySelector("#editor").addEventListener('input', function (e) {
    			let data_ui = e.target.innerHTML;
    			let data_repl = data_ui.match(/<span([\s\S]*?)>([\s\S]*?)<\/span>/gi);

    			for (let i in data_repl) {
    				let originalkey = data_repl[i].match(/original_key="([\s\S]*?)"/g);

    				if (originalkey) {
    					originalkey = originalkey.toString().replace(/original_key=/g, "").replace(/"/g, "");
    					data_ui = data_ui.replace(data_repl[i], "%{" + originalkey + "}%");
    				}
    			}

    			$$invalidate(0, default_xml = '<smxml type="9" name="FillInTheBlank"><text matchtype="1"><![CDATA[' + data_ui + "]]></text></smxml>");
    		});
    	});

    	// Here we update our value of modal input textbox update in XML between %{ANYVALUE}% 
    	function update_XML(index) {
    		regex = new RegExp(xml_arr[index]);
    		$$invalidate(0, default_xml = default_xml.replace(regex, "%{" + document.querySelector(`#set_xml${index}`).value + "}%"));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(2, menu = true);
    	const click_handler_1 = () => $$invalidate(2, menu = false);

    	$$self.$capture_state = () => ({
    		beforeUpdate,
    		onMount,
    		Header,
    		Modal,
    		FillInTheBlanks,
    		FillInTheBlanksPreview,
    		getDefaultXMl,
    		XMLToJSON,
    		default_xml,
    		data,
    		xml_arr,
    		input_data,
    		auth_xml,
    		menu,
    		inputs,
    		regex,
    		set_value,
    		index,
    		update_XML
    	});

    	$$self.$inject_state = $$props => {
    		if ('default_xml' in $$props) $$invalidate(0, default_xml = $$props.default_xml);
    		if ('data' in $$props) data = $$props.data;
    		if ('xml_arr' in $$props) xml_arr = $$props.xml_arr;
    		if ('input_data' in $$props) input_data = $$props.input_data;
    		if ('auth_xml' in $$props) $$invalidate(1, auth_xml = $$props.auth_xml);
    		if ('menu' in $$props) $$invalidate(2, menu = $$props.menu);
    		if ('inputs' in $$props) inputs = $$props.inputs;
    		if ('regex' in $$props) regex = $$props.regex;
    		if ('set_value' in $$props) $$invalidate(3, set_value = $$props.set_value);
    		if ('index' in $$props) $$invalidate(4, index = $$props.index);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		default_xml,
    		auth_xml,
    		menu,
    		set_value,
    		index,
    		update_XML,
    		click_handler,
    		click_handler_1
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,

    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
