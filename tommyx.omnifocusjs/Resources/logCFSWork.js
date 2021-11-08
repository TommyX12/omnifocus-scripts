(() => {
    let action = new PlugIn.Action(function (selection, sender) {
        const {
            getQueuesFolder,
            isTaskActionable,
            isTaskCompletedOrDropped,
            parseTaskParams,
            isUsingCFS,
            getSelectedTasks,
            getParent,
            saveTaskParams,
            cfsSort,
        } = this.common

        let queuesFolder = getQueuesFolder()

        let isActive = (task, taskParams) => {
            if (isTaskCompletedOrDropped(task)) {
                return false
            }

            let hasAvailableChildren = false
            if (task instanceof Project && !task.containsSingletonActions) {
                hasAvailableChildren = task.nextTask && task.nextTask !== task.task
            } else {
                hasAvailableChildren = task.children.some(child => {
                    return isTaskActionable(child.taskStatus)
                })
            }

            if (hasAvailableChildren) {
                return true
            }

            let isSelfAvailable = false
            if (!taskParams.isContainerOnly) {
                isSelfAvailable = isTaskActionable(task.taskStatus)
            }
            return isSelfAvailable
        }

        let logWork = (task, duration, siblings) => {
            let taskParams = parseTaskParams(task)
            let siblingParams = siblings.map(parseTaskParams)

            let runtime = taskParams.vruntime || 0
            let weight = taskParams.weight
            let delta = Math.ceil(duration / weight)
            taskParams.vruntime = runtime + delta
            saveTaskParams(task, taskParams)
            for (let i = 0; i < siblings.length; ++i) {
                if (siblings[i] === task) {
                    siblingParams[i] = taskParams
                }
            }

            // normalization

            // find min runtime of active tasks
            let minRuntime = -1
            for (let i = 0; i < siblings.length; ++i) {
                let t = siblings[i]
                let tParams = siblingParams[i]
                let runtime = tParams.vruntime || 0
                if ((t === task || isActive(t, tParams))
                    && (minRuntime === -1 || runtime < minRuntime)) {
                    minRuntime = runtime
                }
            }
            // inactive tasks gets moved along with the current task, bounded by min runtime of active tasks
            for (let i = 0; i < siblings.length; ++i) {
                let t = siblings[i]
                let tParams = siblingParams[i]
                let runtime = tParams.vruntime || 0
                if (t !== task && !isActive(t, tParams)) {
                    tParams.vruntime = Math.max(runtime, Math.min(minRuntime, runtime + delta))
                }
            }
            // now find min runtime of all tasks
            minRuntime = -1
            for (let i = 0; i < siblings.length; ++i) {
                let t = siblings[i]
                let tParams = siblingParams[i]
                let runtime = tParams.vruntime || 0
                if (minRuntime === -1 || runtime < minRuntime) {
                    minRuntime = runtime
                }
            }
            // normalizes so that their minimum becomes 0
            if (minRuntime !== -1) {
                let delta = minRuntime
                for (let i = 0; i < siblings.length; ++i) {
                    let t = siblings[i]
                    let tParams = siblingParams[i]
                    let runtime = tParams.vruntime || 0
                    tParams.vruntime = Math.max(0, runtime - delta)
                    saveTaskParams(t, tParams)
                }
            }
        }

        let inputForm = new Form()
        let dateFormat = Formatter.Date.Style.Short
        let dateFormatter = Formatter.Date.withStyle(dateFormat, dateFormat)

        let durationField = new Form.Field.String(
            "duration",
            "Duration (hours)",
            "0.5"
        )

        inputForm.addField(durationField)

        let formPromise = inputForm.show("Enter duration", "Continue")

        inputForm.validate = function (formObject) {
            let duration = parseFloat(formObject.values["duration"])
            return !isNaN(duration) && duration >= 0
        }

        formPromise.then(function (formObject) {
            try {
                let task = getSelectedTasks(selection)[0]
                let parent = getParent(task)
                while (parent) {
                    if (isUsingCFS(parent, queuesFolder)) {
                        let isFolder = parent instanceof Folder
                        logWork(
                            task,
                            Math.round(parseFloat(formObject.values["duration"]) * 60),
                            isFolder ? parent.projects : parent.children)

                        cfsSort(parent)
                    }
                    task = parent
                    parent = getParent(parent)
                }
            } catch (err) {
                console.error(err)
            }
        })

        formPromise.catch(function (err) {
            console.log("form cancelled", err.message)
        })
    });

    action.validate = function (selection, sender) {
        const {
            getQueuesFolder,
            isUsingCFS,
            getSelectedTasks,
            getParent,
        } = this.common

        let queuesFolder = getQueuesFolder()
        if (!queuesFolder) return false;

        let selected = getSelectedTasks(selection)
        if (selected.length !== 1) return false;

        let task = selected[0]

        let parent = getParent(task)
        while (parent) {
            if (!isUsingCFS(parent, queuesFolder)) return false
            if (parent === queuesFolder) return true
            task = parent
            parent = getParent(parent)
        }

        return false
    };

    return action;
})();
