<script context="module">
    export function getDefaultXMl(type) {
    let xmls = {
        "editor_item_5.xml": '<smxml type="9" name="FillInTheBlank"><text matchtype="1"><![CDATA[Education then beyond all other devices of %{human}% origin, is the great equalizer of the %{conditions}% of man.]]></text></smxml>',
        "editor_item_1.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, beyond all other devices of %{a+b|e}% origin, is the great equalizer of the conditions.]]--></text></smxml>',
        "editor_item_3.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, beyond all other devices of %{data|{"defaultAns":"ds","rows":"2","cols":"10"}}% origin, is the great equalizer of the conditions.]]--></text></smxml>',
        "editor_item_6.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, beyond all other devices of %{person,*human,+man|s}% origin, is the great equalizer of the %{situations,*conditions|s}% of man.]]--></text></smxml>',
        "editor_item_7.xml": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, %{beyond|d}% all other devices of %{human|d}% origin, is the great equalizer of the %{conditions|d}% of man.]]--></text></smxml>',
        "sample": '<smxml xmlns="http://www.w3.org/1999/xhtml" type="9" name="FillInTheBlank"><text matchtype="1"><!--[CDATA[Education, then, %{beyond|d}% all other devices of %{human|d}% origin, is the great equalizer of the %{conditions|d}% of man.]]--></text></smxml>',
    };

    return xmls[type];
}

</script>