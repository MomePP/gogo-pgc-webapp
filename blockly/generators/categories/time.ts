export default function (gogoGenerator: any) {

    // gogoGenerator.forBlock['time_wait'] = function (block: any, generator: any) {
    //     const wait = generator.valueToCode(block, 'TIME', generator.Order.NONE);
    //     let time = isNaN(parseFloat(wait)) ? 0 : parseFloat(wait) * 1000;
    //     return `wait ${time}\n`;
    // }

    gogoGenerator.forBlock['time_wait_ms'] = function (block: any, generator: any) {
        const wait = generator.valueToCode(block, 'TIME', generator.Order.NONE);
        let time = wait
        return `wait ${time}\n`;
    }
}
