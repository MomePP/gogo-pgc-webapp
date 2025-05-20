export default function (gogoGenerator: any) {

    gogoGenerator.forBlock['movement_forward'] = function (block: any, generator: any) {
        // const steps = generator.valueToCode(block, 'STEPS', generator.Order.ATOMIC);
        // return `forward(${steps});\n`;
        return `forward\n`
    }

    gogoGenerator.forBlock['movement_backward'] = function (block: any, generator: any) {
        // const steps = generator.valueToCode(block, 'STEPS', generator.Order.ATOMIC);
        // return `backward(${steps});\n`;
        return `backward\n`
    }

    gogoGenerator.forBlock['movement_left'] = function (block: any, generator: any) {
        // const degrees = generator.valueToCode(block, 'DEGREES', generator.Order.ATOMIC);
        // return `turnLeft(${degrees});\n`;
        return `left\n`
    }

    gogoGenerator.forBlock['movement_right'] = function (block: any, generator: any) {
        // const degrees = generator.valueToCode(block, 'DEGREES', generator.Order.ATOMIC);
        // return `turnRight(${degrees});\n`;
        return `right\n`
    }

    gogoGenerator.forBlock['movement_stop'] = function (block: any, generator: any) {
        return `stop\n`
    }

}
