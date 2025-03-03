const { saveTaskToDB, getAllTasks, deleteTaskFromDB } = require('../src/renderer.js');

describe('IndexedDB Task Storage', () => {
    test('should save a task to IndexedDB', async () => {
        const testTask = { id: 'task-1', title: 'Test Task', completed: false };
        await saveTaskToDB(testTask);
        const tasks = await getAllTasks();
        expect(tasks).toEqual(expect.arrayContaining([testTask]));
    });

    test('should delete a task from IndexedDB', async () => {
        await deleteTaskFromDB('task-1');
        const tasks = await getAllTasks();
        expect(tasks.some(t => t.id === 'task-1')).toBe(false);
    });
});
