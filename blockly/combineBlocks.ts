/**
 * Combine Blocks Utility
 * 
 * Provides functionality to detect, highlight, and combine
 * adjacent identical blocks in Blockly.
 */

// Block types that should never be combined
const EXCLUDED_TYPES = ['movement_stop'];

// CSS class for highlighting bunch
const HIGHLIGHT_CLASS = 'blockly-bunch-highlight';

// Currently highlighted blocks
let highlightedBlocks: any[] = [];

/**
 * Check if a block type is excluded from combining
 */
export const isExcludedType = (block: any): boolean => {
    return EXCLUDED_TYPES.includes(block.type);
};

/**
 * Compare two blocks to see if they are "identical" for combining purposes
 * - Same type
 * - Same field values
 */
export const isSameCommand = (a: any, b: any): boolean => {
    if (!a || !b) return false;
    if (a.type !== b.type) return false;

    // Compare field values
    const aFields = a.inputList?.flatMap((input: any) =>
        input.fieldRow?.map((field: any) => ({
            name: field.name,
            value: field.getValue?.()
        })) || []
    ) || [];

    const bFields = b.inputList?.flatMap((input: any) =>
        input.fieldRow?.map((field: any) => ({
            name: field.name,
            value: field.getValue?.()
        })) || []
    ) || [];

    if (aFields.length !== bFields.length) return false;

    for (let i = 0; i < aFields.length; i++) {
        if (aFields[i].name !== bFields[i].name) return false;
        if (aFields[i].value !== bFields[i].value) return false;
    }

    return true;
};

/**
 * Get the contiguous bunch of identical blocks containing the given block.
 * Stops at excluded types (like movement_stop).
 * 
 * @param startBlock The block that was clicked
 * @returns Array of blocks in the bunch (ordered top to bottom)
 */
export const getBunch = (startBlock: any): any[] => {
    if (!startBlock) return [];
    if (isExcludedType(startBlock)) return [];

    const bunch: any[] = [];

    // Walk upward to find the first block in the bunch
    let topBlock = startBlock;
    while (true) {
        const prev = topBlock.getPreviousBlock?.();
        if (!prev) break;
        if (isExcludedType(prev)) break;
        if (!isSameCommand(prev, startBlock)) break;
        topBlock = prev;
    }

    // Walk downward from topBlock, collecting the bunch
    let current = topBlock;
    while (current) {
        if (isExcludedType(current)) break;
        if (!isSameCommand(current, startBlock)) break;
        bunch.push(current);
        current = current.getNextBlock?.();
    }

    return bunch;
};

/**
 * Apply highlight CSS class to all blocks in the bunch
 */
export const highlightBunch = (blocks: any[]): void => {
    clearHighlight();

    blocks.forEach(block => {
        const svgGroup = block.getSvgRoot?.();
        if (svgGroup) {
            svgGroup.classList.add(HIGHLIGHT_CLASS);
        }
    });

    highlightedBlocks = blocks;
};

/**
 * Clear all bunch highlights
 */
export const clearHighlight = (): void => {
    highlightedBlocks.forEach(block => {
        const svgGroup = block.getSvgRoot?.();
        if (svgGroup) {
            svgGroup.classList.remove(HIGHLIGHT_CLASS);
        }
    });
    highlightedBlocks = [];
};

/**
 * Get the base type from a combined type
 * e.g., "movement_forward_combined" -> "movement_forward"
 */
export const getBaseType = (type: string): string => {
    return type.replace('_combined', '');
};

/**
 * Get the combined type from a base type
 * e.g., "movement_forward" -> "movement_forward_combined"
 */
export const getCombinedType = (type: string): string => {
    if (type.endsWith('_combined')) return type;
    return `${type}_combined`;
};

/**
 * Mapping from base types to their combined equivalents
 */
export const COMBINABLE_TYPES: Record<string, string> = {
    'movement_forward': 'movement_forward_combined',
    'movement_backward': 'movement_backward_combined',
    'movement_left': 'movement_left_combined',
    'movement_right': 'movement_right_combined',
    'movement_beep': 'movement_beep_combined',
};

/**
 * Check if a block type is combinable
 */
export const isCombinable = (type: string): boolean => {
    return type in COMBINABLE_TYPES;
};

/**
 * Combine a bunch of blocks into a single combined block
 * 
 * @param blocks Array of blocks to combine (must be N >= 2)
 * @param workspace The Blockly workspace
 * @param Blockly The Blockly library reference
 */
export const combineBunch = (blocks: any[], workspace: any, Blockly: any): void => {
    if (blocks.length < 2) return;

    const firstBlock = blocks[0];
    const lastBlock = blocks[blocks.length - 1];
    const count = blocks.length;
    const baseType = firstBlock.type;

    if (!isCombinable(baseType)) return;

    const combinedType = COMBINABLE_TYPES[baseType];

    // Start event group for single undo
    Blockly.Events.setGroup(true);

    try {
        console.log(`[Combine] Starting combine for type ${baseType}`);

        // 1. Find the root block (the top-level block that contains our bunch)
        let rootBlock = firstBlock;
        while (rootBlock.getParent()) {
            rootBlock = rootBlock.getParent();
        }
        const rootBlockId = rootBlock.id;
        console.log(`[Combine] Root block: ${rootBlock.type} (id: ${rootBlockId})`);

        // 2. Serialize the entire root block tree
        const rootState = Blockly.serialization.blocks.save(rootBlock, {
            addCoordinates: true,
            addInputBlocks: true,
            addNextBlocks: true,
        });
        console.log(`[Combine] Root block state BEFORE:`, JSON.stringify(rootState, null, 2));

        // 3. Get the IDs of blocks to replace
        const bunchIds = new Set(blocks.map(b => b.id));
        const firstBlockId = firstBlock.id;
        const lastBlockId = lastBlock.id;

        // 4. Find what comes after the bunch (by ID)
        let afterBunchState: any = null;
        if (lastBlock.nextConnection?.isConnected()) {
            const nextBlock = lastBlock.nextConnection.targetConnection?.getSourceBlock();
            if (nextBlock) {
                afterBunchState = Blockly.serialization.blocks.save(nextBlock, {
                    addCoordinates: false,
                    addInputBlocks: true,
                    addNextBlocks: true,
                });
            }
        }

        // 5. Create the combined block state
        const combinedBlockState: any = {
            type: combinedType,
            fields: {
                COUNT: count
            }
        };
        if (afterBunchState) {
            combinedBlockState.next = { block: afterBunchState };
        }

        // 6. Recursively find and replace the bunch in the state tree
        const replaceBunchInState = (state: any): boolean => {
            if (!state) return false;

            // Check inputs (for statement inputs like 'statement')
            if (state.inputs) {
                for (const inputName in state.inputs) {
                    const input = state.inputs[inputName];
                    if (input.block) {
                        // Is this the first block of our bunch?
                        if (input.block.id === firstBlockId) {
                            console.log(`[Combine] Found bunch at input '${inputName}'`);
                            // Replace with combined block
                            input.block = combinedBlockState;
                            return true;
                        }
                        // Recurse into nested blocks
                        if (replaceBunchInState(input.block)) return true;
                    }
                }
            }

            // Check next chain
            if (state.next?.block) {
                if (state.next.block.id === firstBlockId) {
                    console.log(`[Combine] Found bunch in next chain`);
                    // Replace with combined block
                    state.next.block = combinedBlockState;
                    return true;
                }
                // Recurse into next chain
                if (replaceBunchInState(state.next.block)) return true;
            }

            return false;
        };

        const replaced = replaceBunchInState(rootState);
        console.log(`[Combine] Replacement successful: ${replaced}`);
        console.log(`[Combine] Root block state AFTER:`, JSON.stringify(rootState, null, 2));

        // 7. Delete the old root block
        rootBlock.dispose(false, false);

        // 8. Recreate the entire tree from the modified state
        const newRootBlock = Blockly.serialization.blocks.append(rootState, workspace);
        console.log(`[Combine] Recreated root block: ${newRootBlock.type}`);

        // 9. Select the new combined block (find it in the new tree)
        const findCombinedBlock = (block: any): any => {
            if (block.type === combinedType) return block;
            // Check inputs
            for (const input of block.inputList || []) {
                if (input.connection?.targetBlock()) {
                    let current = input.connection.targetBlock();
                    while (current) {
                        if (current.type === combinedType) return current;
                        const found = findCombinedBlock(current);
                        if (found) return found;
                        current = current.getNextBlock();
                    }
                }
            }
            // Check next
            if (block.getNextBlock()) {
                const found = findCombinedBlock(block.getNextBlock());
                if (found) return found;
            }
            return null;
        };

        const newCombinedBlock = findCombinedBlock(newRootBlock);
        if (newCombinedBlock) {
            newCombinedBlock.select();
        }

        console.log(`[Combine] Success!`);

    } catch (err) {
        console.error('[Combine] Fatal error:', err);
    } finally {
        Blockly.Events.setGroup(false);
    }

    clearHighlight();
};

/**
 * Get the currently highlighted blocks
 */
export const getHighlightedBlocks = (): any[] => {
    return highlightedBlocks;
};
