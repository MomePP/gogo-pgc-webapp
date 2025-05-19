export default function(Blockly: any) {

    const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
        // {
        //     type: 'time_wait',
        //     message0: 'Wait %1 second',
        //     args0: [{ type: 'input_value', name: 'TIME', check: 'Number' }],
        //     previousStatement: true,
        //     nextStatement: true,
        //     style: 'time_blocks',
        //     tooltip: 'Wait for the specified time before proceeding to the next block',
        //     helpUrl: ''
        // },
        {
            type: 'time_wait_ms',
            message0: 'wait %1 ms',
            args0: [{ type: 'input_value', name: 'TIME', check: 'Number' }],
            previousStatement: true,
            nextStatement: true,
            style: 'time_blocks',
            tooltip: 'Wait for the specified time before proceeding to the next block',
            helpUrl: ''
        },
    ])

    return blocks
}
