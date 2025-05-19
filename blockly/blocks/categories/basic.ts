export default function (Blockly: any) {

    Blockly.Blocks['main_start'] = {
        init: function () {
            this.appendDummyInput()
                .appendField('  Start')
            this.appendStatementInput('statement', null)
            var input = this.appendDummyInput()
            input.appendField('                        end')
            this.setTooltip('')
            this.setDeletable(false)
            this.setStyle('basic_blocks')
        }
    }
}
