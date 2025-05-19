export default function (gogoGenerator: any) {

    gogoGenerator.forBlock['math_number'] = function (block: any, generator: any) {
        const textNumber = block.getFieldValue('NUM')
        let code = textNumber
        return [code, generator.Order.NONE]
    }
}
