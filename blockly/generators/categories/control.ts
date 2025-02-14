export default function(gogoGenerator: any) {

    gogoGenerator.forBlock['control_forward'] = function(block: any, generator: any) {
        // const steps = generator.valueToCode(block, 'STEPS', generator.Order.ATOMIC);
        // return `forward(${steps});\n`;
        return `forward\n`
    }

    gogoGenerator.forBlock['control_backward'] = function(block: any, generator: any) {
        // const steps = generator.valueToCode(block, 'STEPS', generator.Order.ATOMIC);
        // return `backward(${steps});\n`;
        return `backward\n`
    }

    gogoGenerator.forBlock['control_turn_left'] = function(block: any, generator: any) {
        // const degrees = generator.valueToCode(block, 'DEGREES', generator.Order.ATOMIC);
        // return `turnLeft(${degrees});\n`;
        return `turnleft\n`
    }

    gogoGenerator.forBlock['control_turn_right'] = function(block: any, generator: any) {
        // const degrees = generator.valueToCode(block, 'DEGREES', generator.Order.ATOMIC);
        // return `turnRight(${degrees});\n`;
        return `turnright\n`
    }
}
