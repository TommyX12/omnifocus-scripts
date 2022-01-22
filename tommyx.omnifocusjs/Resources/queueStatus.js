(() => {
    let action = new PlugIn.Action(function (selection, sender) {
        const lib = this.common

        let reminders = flattenedProjects.byName('Reminders')
        let main = flattenedProjects.byName('Main')
        if (!reminders) {
            new Alert("Error", 'No project named Reminders').show()
            return
        }
        if (!main) {
            new Alert("Error", 'No project named Main').show()
            return
        }

        let text = []

        let currentTime = new Date().getTime()
        let focusEndTime = -1
        let focusTimeReason = null
        const updateFocusEndTime = (type, task) => {
            if (lib.isTaskRemaining(task.taskStatus)) {
                if (task.deferDate) {
                    const time = task.deferDate.getTime()
                    if (time > currentTime) {
                        if (focusEndTime === -1 || time < focusEndTime) {
                            focusEndTime = time
                            focusTimeReason = `${type} [${task.name}] will become available`
                        }
                    }
                }
                if (task.dueDate) {
                    const time = new Date(
                        task.dueDate.getFullYear(),
                        task.dueDate.getMonth(),
                        task.dueDate.getDate()).getTime()
                    if (time > currentTime) {
                        if (focusEndTime === -1 || time < focusEndTime) {
                            focusEndTime = time
                            focusTimeReason = `${type} [${task.name}] will be due`
                        }
                    }
                }
            }
        }

        reminders.flattenedTasks.forEach(
            task => updateFocusEndTime('Reminder', task))
        let nextMainTask = main.nextTask
        let nextTaskFound = false
        main.flattenedTasks.forEach(task => {
            if (nextTaskFound) return
            if (task === nextMainTask) {
                nextTaskFound = true
            } else {
                updateFocusEndTime('Main task', task)
            }
        })

        let focusTimeText = 'infinity'
        if (focusEndTime !== -1) {
            let focusSeconds = Math.floor((focusEndTime - currentTime) / 1000)
            let focusMinutes = Math.floor(focusSeconds / 60)
            focusSeconds -= focusMinutes * 60
            let focusHours = Math.floor(focusMinutes / 60)
            focusMinutes -= focusHours * 60
            let focusTimeTextList = []
            if (focusHours > 0) {
                focusTimeTextList.push(`${Math.floor(focusHours)}h`)
            }
            if (focusMinutes > 0) {
                focusTimeTextList.push(`${Math.floor(focusMinutes)}m`)
            }
            if (focusSeconds > 0) {
                focusTimeTextList.push(`${Math.floor(focusSeconds)}s`)
            }
            focusTimeText = focusTimeTextList.join(' ')
        }

        text.push('Max focus time (excluding inbox):')
        text.push(focusTimeText)
        if (focusTimeReason) {
            text.push(focusTimeReason)
        }
        new Alert("Queue Status", text.join("\n")).show()
    });

    action.validate = function (selection, sender) {
        return true
    };

    return action;
})();
