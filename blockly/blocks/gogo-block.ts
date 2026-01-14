import basicBlocks from './categories/basic'
import controlBlocks from './categories/control'
import timeBlocks from './categories/time'

export default function (Blockly: any) {

    Blockly.common.defineBlocks(basicBlocks(Blockly))
    Blockly.common.defineBlocks(controlBlocks(Blockly))
    Blockly.common.defineBlocks(timeBlocks(Blockly))

    // HACK: disable click-to-edit dialog
    Blockly.Blocks['math_number'].onchange = function () {
        for (let i = 0; i < this.inputList.length; i++) {
            const input = this.inputList[i];
            for (let j = 0; j < input.fieldRow.length; j++) {
                const field = input.fieldRow[j];
                if (field instanceof Blockly.FieldNumber || field instanceof Blockly.FieldTextInput) {
                    field.showEditor_ = function () {
                        Blockly.FieldTextInput.prototype.showEditor_.call(this);
                    };
                }
            }
        }
    };
}
