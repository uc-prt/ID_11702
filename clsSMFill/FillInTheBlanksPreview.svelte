<script>
    import { afterUpdate, beforeUpdate, onMount } from "svelte";
    import { XMLToJSON } from "../helper/HelperAI.svelte";
    export let default_xml;
    let data_array = [];
    let input_box = '';
    let regex = '';
    let marked = false;
    let checked = false;
    let data = XMLToJSON(default_xml)["smxml"]["text"]["__cdata"];  // Here we get the data in human readable format
    let auth_xml = data;
    let xml_arr  =  data.match(/%{[\s\S]*?}%/gm);
    beforeUpdate(() => {
        for (let i in xml_arr) {
            // For extracting the value between %{ANYTEXT}%. i.e. return value ANYTEXT; 
		    data_array[i] = xml_arr[i].replace(/%{/gm, "").replace(/}%/gm, "").replace(/|d}%/gm, "");
            input_box = `<input type="text" class="input_set text" id="inputBox${i}" correct_ans=${data_array[i]} user_ans='' index=${i} style="width:100px;"/>`;
            regex = new RegExp(xml_arr[i]);
            // Here we replace all regex value with input box
            auth_xml = auth_xml.replace(regex, input_box);
	    }
    })
    onMount(() => {
        // Here we toggle the switch value
        document.querySelector("#chk_switch").addEventListener('click',function() {
            checked = !checked;
        })
        // Here we set the userans value for all input box
        document.querySelectorAll(".input_set").forEach(items => {
            items.addEventListener('input',function(e) {
                items.setAttribute("user_ans",e.target.value)
            })
        })  
    })
    afterUpdate(() => {
        if(!checked) {
            for(let i in xml_arr) {
                document.querySelector(`#inputBox${i}`).value= document.querySelector(`#inputBox${i}`).getAttribute("user_ans");
            } 
        }
        //  Here border generate on Answer checking correct or incorrect
        if(checked && !marked || checked && document.querySelector("#btnradio2").checked==true) {
            for(let i in xml_arr) {
                if(document.querySelector(`#inputBox${i}`).getAttribute('user_ans')==document.querySelector(`#inputBox${i}`).getAttribute('correct_ans')) {
                    document.querySelector(`#inputBox${i}`).style.border="2px solid green"
                } else {
                    document.querySelector(`#inputBox${i}`).style.border="2px solid red";
                }
            }
        } else{
            for(let i in xml_arr) {           
                document.querySelector(`#inputBox${i}`).style.border="none";
            }
        }
    })
    //  In this function we toggle answer between correct and given & Also checking for correct and incorrect
    function Toggle_Answer(type) {
        if(type=="correct") {
            marked=true;
            for(let i in xml_arr) {
                let inputModal=document.querySelector(`#inputBox${i}`);
                inputModal.value= inputModal.getAttribute("correct_ans");
                inputModal.style.border="none";
            }
        } else {
            marked=false;
            for(let i in xml_arr) {
                let inputModal=document.querySelector(`#inputBox${i}`);
                inputModal.value= inputModal.getAttribute("user_ans");
                if(inputModal.getAttribute("correct_ans")==inputModal.getAttribute("user_ans")) {
                    inputModal.style.border="2px solid green"
                } else {
                    inputModal.style.border="2px solid red"
                }
            }
        }
    }
</script>

<div class="container">
    <div class="authoring_view mt-1 px-1">
        {#if checked}
            <center>
                <div class="btn-group text-center m-auto" role="group" aria-label="Basic radio toggle button group">
                    <input type="radio" class="btn-check" name="btnradio" id="btnradio1">
                    <label class="btn btn-outline-primary" for="btnradio1" on:click="{()=>Toggle_Answer("correct")}">Correct Answer</label>                   
                    <input type="radio" class="btn-check" name="btnradio" id="btnradio2" checked/>
                    <label class="btn btn-outline-primary" for="btnradio2" on:click="{()=>Toggle_Answer("your")}">Your Answer</label>
                </div>
            </center>
        {/if}
        <div class="{checked?"disabled":""}  pt-4 px-5" id="preview_xml">
            {@html auth_xml}
        </div>
        <div class="text-danger mt-4 px-5" style="font-size: 15px;">
            <p>*Matching is not case sensitive.</p>
        </div>
    </div>
</div>
