import { useEffect } from 'react';
import { useTaskStore } from '../store';

export const useNotifications = () => {
    const tasks = useTaskStore((state) => state.tasks);

    useEffect(() => {
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        Object.values(tasks).forEach((task) => {
            if (task && (task.status === 'Complete' || task.status === 'Error')) {
                new Notification(`Task ${task.name} ${task.status}`, {
                    body: `Task ${task.name} has finished with status: ${task.status}`,
                });
            }
        });
    }, [tasks]);
};
