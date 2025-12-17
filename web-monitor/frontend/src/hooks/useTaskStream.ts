import { useEffect } from 'react';
import { useTaskStore } from '../store';
import { JulesTask } from '../types';
import { getApiUrl, config } from '../config';

export const useTaskStream = (taskIds: string[]) => {
  const { updateTask, setTasks } = useTaskStore();

  useEffect(() => {
    // Fetch initial data
    const fetchInitialData = async () => {
        try {
            const response = await fetch(getApiUrl(config.apiEndpoints.tasks));
            const tasks: JulesTask[] = await response.json();
            setTasks(tasks);
        } catch (error) {
            console.error('Failed to fetch initial task data:', error);
        }
    };

    fetchInitialData();
  }, [setTasks]);


  useEffect(() => {
    const eventSources: EventSource[] = [];

    taskIds.forEach(id => {
      const es = new EventSource(getApiUrl(config.apiEndpoints.taskStream(id)));
      
      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'initial' || data.type === 'update') {
          updateTask(data.payload);
        }
      };

      es.onerror = (err) => {
        console.error(`EventSource failed for task ${id}:`, err);
        es.close();
      };

      eventSources.push(es);
    });

    return () => {
      eventSources.forEach(es => es.close());
    };
  }, [taskIds, updateTask]);
};
