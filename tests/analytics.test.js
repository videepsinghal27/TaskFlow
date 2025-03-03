const { updateAnalyticsUI } = require('../src/renderer.js');

describe('Analytics Calculations', () => {
    test('should correctly count completed, pending, and overdue tasks', () => {
        const sampleTasks = [
            { id: '1', completed: true, reminderDate: '2024-12-01' },
            { id: '2', completed: false, reminderDate: '2023-11-30' }, // Overdue
            { id: '3', completed: false, reminderDate: '2024-12-05' }
        ];
        
        updateAnalyticsUI(sampleTasks);

        expect(document.getElementById("completedTasks").textContent).toBe("1");
        expect(document.getElementById("pendingTasks").textContent).toBe("2");
        expect(document.getElementById("overdueTasks").textContent).toBe("1");
    });
});
