// db.js - IndexedDB setup for TaskFlow

const DB_NAME = 'TaskFlowDB';
const STORE_NAME = 'tasks';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Add a task
async function addTask(task) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(task);
    return tx.complete;
}

// Get all tasks
async function getAllTasks() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return store.getAll();
}

// Update a task
async function updateTask(task) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(task);
    return tx.complete;
}

// Delete a task
async function deleteTask(taskId) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(taskId);
    return tx.complete;
}

// Clear all tasks
async function clearTasks() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    return tx.complete;
}

export { addTask, getAllTasks, updateTask, deleteTask, clearTasks };
