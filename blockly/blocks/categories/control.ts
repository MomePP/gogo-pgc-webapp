export default function (Blockly: any) {
    // Blockly.Color = Blockly.Color || {}

    // Blockly.Color.CONTROL = '#418bd2'
    // Blockly.Msg.CONTROL_HUE = Blockly.Color.CONTROL
    // Blockly.Msg.COLOR_CONTROL = Blockly.Color.CONTROL

    // Blockly.Msg.ICON_CONTROL = ''

    // let CONTROL_COLOR = '#418bd2'

    const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
        {
            type: 'movement_forward',
            message0: 'forward',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            colour: '#66D9A6',
            tooltip: 'Moves forward',
            helpUrl: ''
        },
        {
            type: 'movement_backward',
            message0: 'backward',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            colour: '#FF8A95',
            tooltip: 'Moves backward',
            helpUrl: ''
        },
        {
            type: 'movement_left',
            message0: 'turn left',
            // args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            colour: '#A996D4',
            tooltip: 'Turns left',
            helpUrl: ''
        },
        {
            type: 'movement_right',
            message0: 'turn right',
            // args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            colour: '#FFA04A',
            tooltip: 'Turns right',
            helpUrl: ''
        },
        {
            type: 'movement_stop',
            message0: 'stop',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            colour: '#FF6B6B',
            // style: 'movement_blocks',
            tooltip: 'Stop move',
            helpUrl: ''
        },
        {
            type: 'movement_beep',
            message0: 'beep',
            previousStatement: true,
            nextStatement: true,
            colour: '#FFCA28',
            tooltip: 'Make a beep sound',
            helpUrl: ''
        },
        // Combined block variants
        {
            type: 'movement_forward_combined',
            message0: 'forward x%1',
            args0: [{ type: 'field_number', name: 'COUNT', value: 2, min: 2, max: 99, precision: 1 }],
            previousStatement: true,
            nextStatement: true,
            colour: '#66D9A6',
            tooltip: 'Move forward multiple times',
            helpUrl: ''
        },
        {
            type: 'movement_backward_combined',
            message0: 'backward x%1',
            args0: [{ type: 'field_number', name: 'COUNT', value: 2, min: 2, max: 99, precision: 1 }],
            previousStatement: true,
            nextStatement: true,
            colour: '#FF8A95',
            tooltip: 'Move backward multiple times',
            helpUrl: ''
        },
        {
            type: 'movement_left_combined',
            message0: 'turn left x%1',
            args0: [{ type: 'field_number', name: 'COUNT', value: 2, min: 2, max: 99, precision: 1 }],
            previousStatement: true,
            nextStatement: true,
            colour: '#A996D4',
            tooltip: 'Turn left multiple times',
            helpUrl: ''
        },
        {
            type: 'movement_right_combined',
            message0: 'turn right x%1',
            args0: [{ type: 'field_number', name: 'COUNT', value: 2, min: 2, max: 99, precision: 1 }],
            previousStatement: true,
            nextStatement: true,
            colour: '#FFA04A',
            tooltip: 'Turn right multiple times',
            helpUrl: ''
        },
        {
            type: 'movement_beep_combined',
            message0: 'beep x%1',
            args0: [{ type: 'field_number', name: 'COUNT', value: 2, min: 2, max: 99, precision: 1 }],
            previousStatement: true,
            nextStatement: true,
            colour: '#FFCA28',
            tooltip: 'Beep multiple times',
            helpUrl: ''
        },
    ])

    return blocks
}
