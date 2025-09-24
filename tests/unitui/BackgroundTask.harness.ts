import TaskManager from '@expensify/react-native-background-task';
import {afterEach, beforeEach, describe, expect, it} from '@react-native-harness/runtime';

const waitForNextTick = async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

describe('BackgroundTask', () => {
    it('should be defined', () => {
        expect(TaskManager).toBeDefined();
    });

    it('should be able to define a task', async () => {
        await TaskManager.defineTask('test', () => {
            expect('1').toStrictEqual('1');
        });
    });

    it('should be able to execute a task', async () => {
        const task = jest.fn();
        await TaskManager.defineTask('test', task);
        await waitForNextTick();
        expect(task).toHaveBeenCalled();
    });
});
