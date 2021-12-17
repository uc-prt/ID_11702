<script>
	import { beforeUpdate, onMount } from "svelte";
	import Header from './Components/Header.svelte';
	import Modal from './Components/Modal.svelte';
	import FillInTheBlanks  from "../clsSMFill/FillInTheBlanks.svelte";
	import FillInTheBlanksPreview from "../clsSMFill/FillInTheBlanksPreview.svelte";
	import { getDefaultXMl } from "../clsSMFill/defaultXML.svelte";
	import { XMLToJSON } from "../helper/HelperAI.svelte";
	import "./app.css";
	let default_xml = getDefaultXMl("editor_item_5.xml");		//Here we get the XML format data
	let data = XMLToJSON(default_xml)["smxml"]["text"]["__cdata"]; 		// Here we get the data in human readable format
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
		    auth_xml = auth_xml.replace(regex,input_data)
	    }
	})
	onMount(() => {
		for (let i in xml_arr) {
            document.querySelector(`#input_box${i}`).addEventListener('click',function (e) {
                index = i;
				set_value = e.target.getAttribute("original_key");
            });
        }
		//  Here we update our default XML data after change in editor area
		document.querySelector("#editor").addEventListener('input',function(e) {
            let data_ui = e.target.innerHTML;
            let data_repl = data_ui.match(/<span([\s\S]*?)>([\s\S]*?)<\/span>/gi);
            for (let i in data_repl) {
                let originalkey = data_repl[i].match(/original_key="([\s\S]*?)"/g);
                if (originalkey) {
                    originalkey = originalkey.toString().replace(/original_key=/g, "").replace(/"/g, "");
                    data_ui = data_ui.replace(data_repl[i],"%{" + originalkey + "}%");
                }
            }
            default_xml = '<smxml type="9" name="FillInTheBlank"><text matchtype="1"><![CDATA[' +data_ui +"]]></text></smxml>";
        })
	})
	// Here we update our value of modal input textbox update in XML between %{ANYVALUE}% 
	function update_XML(index) {
		regex = new RegExp(xml_arr[index]);
		default_xml = default_xml.replace(regex,"%{"+document.querySelector(`#set_xml${index}`).value+"}%");
	}
</script>
<!-- Here our UI Start -->
<main>
	<Header {menu}/>
	<ul class="container mt-2 border-bottom" id="menu">
        <li class="{menu?"clicked":"unclicked"}"><a href="/" on:click|preventDefault={() => {menu = true;location.reload();}}>Authoring </a></li> 
        <li class="{!menu?"clicked":"unclicked"}"><a href="/" on:click|preventDefault={() => (menu = false)}>Preview</a></li>
    </ul>
	<div>
		{#if menu==true}
		<FillInTheBlanks {index} {set_value} {auth_xml} on:update={update_XML(index)}/>
		{:else if !menu}
		<FillInTheBlanksPreview {default_xml}/>
		{/if}
	</div>
	<Modal>
		<div slot="modal_body">
			{default_xml}
		</div>
	</Modal>
</main>
