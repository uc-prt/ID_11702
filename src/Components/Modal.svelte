<div class="modal fade" id="exampleModal1" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true" >
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header border-0">
                <slot name="modal_header"></slot>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div name="modal_body" class="modal-body" id="xml_data">
                <slot name="modal_body"></slot>
            </div>
            <div class="modal-footer border-0">
                <slot name="modal_footer"></slot>
            </div>
        </div>
    </div>
</div>
