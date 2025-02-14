export default function(Blockly: any) {
    // Blockly.Color = Blockly.Color || {}

    // Blockly.Color.CONTROL = '#418bd2'
    // Blockly.Msg.CONTROL_HUE = Blockly.Color.CONTROL
    // Blockly.Msg.COLOR_CONTROL = Blockly.Color.CONTROL

    // Blockly.Msg.ICON_CONTROL = ''

    let CONTROL_COLOR = '#418bd2'

    const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
        {
            type: 'control_forward',
            message0: 'Forward',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            colour: CONTROL_COLOR,
            tooltip: 'Moves forward',
            helpUrl: ''
        },
        {
            type: 'control_backward',
            message0: 'Backward',
            // args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            colour: CONTROL_COLOR,
            tooltip: 'Moves backward',
            helpUrl: ''
        },
        {
            type: 'control_turn_left',
            message0: 'Turn left',
            // args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            colour: CONTROL_COLOR,
            tooltip: 'Turns left',
            helpUrl: ''
        },
        {
            type: 'control_turn_right',
            message0: 'Turn right',
            // args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            // colour: Blockly.Color.CONTROL,
            colour: CONTROL_COLOR,
            tooltip: 'Turns right',
            helpUrl: ''
        }
    ])

    return blocks
}
