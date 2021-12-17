<script>
    export let menu;
    export let default_xml;
</script>
<nav class="border-bottom">
    <img class="img-fluid" src="http://localhost/pe-gold3/layout/themes/bootstrap4/images/logo/ucertify_logo.png" alt="ucertify_logo"/>
    <span class="dropdown">
        <span class="btn btn-light " data-bs-toggle="dropdown" aria-expanded="false">
            TOOLS
        </span>
        <ul class="dropdown-menu position-absolute top-0 pt-2" aria-labelledby="dropdownMenuLink">
            <li class="dropdown-item py-2" data-bs-toggle="modal" data-bs-target="#exampleModal" >
                XML
            </li>
            <li class="dropdown-item py-2">Show Algorithmic</li>
        </ul>
    </span>
    {#if menu==false}
    <span class="form-check form-switch reviewchk">
        <input class="form-check-input" type="checkbox" role="switch" id="chk_switch"/>
        <label class="form-check-label" for="chk_switch"
            >Review
        </label>
    </span>
    <button class="btn btn-primary version p-0 px-1">V2.0</button>
    {/if}
</nav>
<div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true" >
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header border-0">
                <h3>XML</h3>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div name="modal_body" class="modal-body" id="xml_data">
                {default_xml}
            </div>
            <div class="modal-footer border-0">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">CANCEL</button>
                <button type="button" class="btn btn-primary">DONE</button>
            </div>
        </div>
    </div>
</div>
