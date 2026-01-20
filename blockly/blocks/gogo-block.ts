import basicBlocks from './categories/basic'
import controlBlocks from './categories/control'
import timeBlocks from './categories/time'

export default function (Blockly: any) {

    Blockly.common.defineBlocks(basicBlocks(Blockly))
    Blockly.common.defineBlocks(controlBlocks(Blockly))
    Blockly.common.defineBlocks(timeBlocks(Blockly))

    // Add validators to combined blocks to enforce 2-digit limit (2-99)
    const combinedBlockTypes = [
        'movement_forward_combined',
        'movement_backward_combined',
        'movement_left_combined',
        'movement_right_combined',
        'movement_beep_combined',
    ];

    combinedBlockTypes.forEach(blockType => {
        const originalInit = Blockly.Blocks[blockType]?.init;
        if (originalInit) {
            Blockly.Blocks[blockType].init = function() {
                originalInit.call(this);
                const countField = this.getField('COUNT');
                if (countField) {
                    // Override showEditor_ to add input restrictions
                    const originalShowEditor = countField.showEditor_.bind(countField);
                    countField.showEditor_ = function(e: any) {
                        originalShowEditor(e);

                        // Hide the SVG text element to prevent ghosting
                        const textEl = countField.textElement_;
                        if (textEl) {
                            textEl.style.visibility = 'hidden';
                        }

                        // Get the HTML input element that Blockly creates
                        const htmlInput = countField.htmlInput_;
                        if (htmlInput) {
                            // Restore text visibility when input loses focus
                            htmlInput.addEventListener('blur', function() {
                                if (textEl) {
                                    textEl.style.visibility = '';
                                }
                            }, { once: true });
                            // Set input attributes
                            htmlInput.setAttribute('maxlength', '2');
                            htmlInput.setAttribute('inputmode', 'numeric');
                            htmlInput.setAttribute('pattern', '[0-9]*');

                            // Intercept keypress to only allow digits
                            htmlInput.addEventListener('keypress', function(evt: KeyboardEvent) {
                                // Allow control keys (backspace, delete, arrows, etc.)
                                if (evt.ctrlKey || evt.metaKey) return;

                                // Only allow digits 0-9
                                if (!/^[0-9]$/.test(evt.key)) {
                                    evt.preventDefault();
                                }
                            });

                            // Intercept input to filter non-digits and enforce 2-digit limit
                            htmlInput.addEventListener('input', function(evt: Event) {
                                const input = evt.target as HTMLInputElement;
                                // Remove any non-digit characters
                                let value = input.value.replace(/[^0-9]/g, '');
                                // Limit to 2 digits
                                if (value.length > 2) {
                                    value = value.slice(0, 2);
                                }
                                if (input.value !== value) {
                                    input.value = value;
                                }
                            });
                        }
                    };

                    // Also add validator for final value clamping (2-99)
                    countField.setValidator(function(newValue: any) {
                        const num = parseInt(newValue, 10);
                        if (isNaN(num) || num < 2) return 2;
                        if (num > 99) return 99;
                        return num;
                    });
                }
            };
        }
    });

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
