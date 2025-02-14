import controlBlocks from './categories/control'

export default function(Blockly: any) {
    Blockly.common.defineBlocks(controlBlocks(Blockly))
}
