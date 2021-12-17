<script>
    import Modal from "../src/Components/Modal.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    export let auth_xml;
    export let set_value;
    export let index;
</script>
<!-- UI Data -->
<div class="container bg-white">
    <h6 class="m-3 bg-light p-1">Title</h6>
    <div class="mb-3 py-2 pl-3 mx-3 border-bottom" contenteditable="true" style="outline: none;" >
        Place Your Text Here
    </div>
    <h6 class="m-3 bg-light p-1">Stem</h6>
    <div class="mb-3 py-2 pl-3 mx-3 border-bottom" contenteditable="true" style="outline: none;">
        Place Your Text Here
    </div>
    <div class="authoring_view mt-3 bg-sky_blue pt-4 px-1">
        <div
            class="bg-white px-2 mt-2 pt-3" style="outline:none" contenteditable="true" id="editor">
            {@html auth_xml}
        </div>
    </div>
    <div class="border-bottom">
        <h6 class="m-3 bg-light p-1">Remediation</h6>
        <div class="mb-5 py-2 mx-3 pl-3" contenteditable="true" style="outline: none;">
            Place Your Text Here
        </div>
    </div>
  </div>
  <!--  Modal Here -->
   <Modal>
		<div slot="modal_header">
		     <h3> XML </h3>
		</div>
		<div slot="modal_body">
			<div>
			<div class="form-check d-inline-block float-left">
                    <input class="form-check-input" type="checkbox" value="" id="flexCheckDefault1"/>
                    <label class="form-check-label" for="flexCheckDefault1">Code</label>
                </div>
                <div class="form-check d-inline-block float-right" style="margin-left: 20%;">
                    <input class="form-check-input" type="checkbox" value="" id="flexCheckDefault2" />
                    <label class="form-check-label" for="flexCheckDefault2">Numeric</label>
                </div>
                <input type="text" id="set_xml{index}" class="form-control my-3" value='{set_value}' placeholder="Write your correct answer" />
                <div class="form-check d-inline-block float-right">
                    <input class="form-check-input" type="checkbox" value="" id="flexCheckDefault2"/>
                    <label class="form-check-label" for="flexCheckDefault2">Enable Style</label>
                </div>
                <input type="text" class="form-control my-3" placeholder="Custom Style" disabled="disabled" />
                <div class="text-danger" style="font-size: 13px;">
                    <h6>*Note :</h6>
                    <p>
                        1. To include multiple correct answers, type the
                        answers and separate them with a comma (,). Please
                        do not include any space. Now, go back to the
                        Settings and select Multiple Correct Answers from
                        the drop-down
                    </p>
                    <p>
                        2. Use #cm for comma (e.g., 5,000 as 5#cm000,
                        function(a,b) as function(a#cmb)).
                    </p>
                </div>
			</div>
		</div>
		<div slot="modal_footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">CANCEL</button>
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal" on:click="{()=>dispatch("update",index)}">DONE</button>
        </div>
	</Modal>
