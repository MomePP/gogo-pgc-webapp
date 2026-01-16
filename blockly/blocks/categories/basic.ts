export default function (Blockly: any) {

    const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
        {
            type: 'main_start',
            implicitAlign0: 'RIGHT',
            message0: 'Repeat %1 time(s) %2 %3 end',
            args0: [
                { type: 'field_number', name: 'repeat', value: 1, min: 1, max: 1000 },
                { type: 'input_dummy' },
                { type: 'input_statement', name: 'statement' },
            ],
            style: 'basic_blocks',
            tooltip: 'Main start block',
            helpUrl: ''
        },
    ])
    console.log('main_start blocks:', blocks)

    return blocks
}
