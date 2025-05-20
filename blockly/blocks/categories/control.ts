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
            // colour: Blockly.Color.CONTROL,
            // colour: CONTROL_COLOR,
            style: 'movement_blocks',
            tooltip: 'Moves forward',
            helpUrl: ''
        },
        {
            type: 'movement_backward',
            message0: 'backward',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            // colour: CONTROL_COLOR,
            style: 'movement_blocks',
            tooltip: 'Moves backward',
            helpUrl: ''
        },
        {
            type: 'movement_left',
            message0: 'turn left',
            // args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            // colour: CONTROL_COLOR,
            style: 'movement_blocks',
            tooltip: 'Turns left',
            helpUrl: ''
        },
        {
            type: 'movement_right',
            message0: 'turn right',
            // args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            // colour: CONTROL_COLOR,
            style: 'movement_blocks',
            tooltip: 'Turns right',
            helpUrl: ''
        },
        {
            type: 'movement_stop',
            message0: 'stop',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            // colour: CONTROL_COLOR,
            style: 'movement_blocks',
            tooltip: 'Stop move',
            helpUrl: ''
        },
    ])

    return blocks
}
