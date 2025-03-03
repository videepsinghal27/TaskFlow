const { addNewTask, toggleTaskCompletion, getTaskById } = require('../src/renderer.js');

describe('Task Management', () => {
    test('should create a new task', async () => {
        const task = { id: 'task-2', title: 'New Task', completed: false };
        await addNewTask(task);
        const savedTask = await getTaskById('task-2');
        expect(savedTask).not.toBeNull();
        expect(savedTask.title).toBe('New Task');
    });

    test('should toggle task completion', async () => {
        await toggleTaskCompletion('task-2');
        const updatedTask = await getTaskById('task-2');
        expect(updatedTask.completed).toBe(true);
    });
});
