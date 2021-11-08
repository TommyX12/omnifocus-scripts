/* eslint-disable no-bitwise, no-plusplus */

(() => {
    const lib = new PlugIn.Library(new Version('1.0'));

    lib.getQueuesFolder = () => folders.byName("Queues")

    let stringParser = value => value

    let floatParser = (value) => {
        let result = parseFloat(value)
        if (isNaN(result)) {
            return undefined
        }
        return result
    }

    let boolParser = (value) => {
        return value.trim() === "true"
    }

    let parsers = {
        vruntime: floatParser,
        weight: floatParser,
        isContainerOnly: boolParser,
        scheduler: stringParser,
    }

    lib.isTaskActionable = (taskStatus) => {
        return taskStatus === Task.Status.Available ||
            taskStatus === Task.Status.DueSoon ||
            taskStatus === Task.Status.Next ||
            taskStatus === Task.Status.Overdue
    }

    lib.isTaskCompletedOrDropped = (taskStatus) => {
        return taskStatus === Task.Status.Completed ||
            taskStatus === Task.Status.Dropped
    }

    lib.defaultTaskParams = {
        vruntime: 0,
        weight: 1,
        isContainerOnly: false,
        scheduler: 'none',
    }

    lib.sortTasksOrProjects = (parent, sorter) => {
        let siblings = (parent instanceof Folder) ? parent.projects : parent.children
        siblings = siblings.filter(
            task => !lib.isTaskCompletedOrDropped(task.taskStatus))
        sorter(siblings)
        if (parent instanceof Folder) {
            moveSections(siblings, parent)
        } else {
            moveTasks(siblings, parent)
        }
    }

    lib.cfsSort = (parent) => {
        lib.sortTasksOrProjects(parent, (siblings) => {
            const vruntimeMap = {}
            for (let i = 0; i < siblings.length; ++i) {
                let t = siblings[i]
                let tParams = lib.parseTaskParams(t)
                let id = t.id.primaryKey
                vruntimeMap[id] = tParams.vruntime || 0
            }
            siblings.sort((a, b) => {
                return vruntimeMap[a.id.primaryKey] - vruntimeMap[b.id.primaryKey]
            })
        })
    }

    lib.bcrSort = (parent) => {
        lib.sortTasksOrProjects(parent, (siblings) => {
            const bcrMap = {}
            for (let i = 0; i < siblings.length; ++i) {
                let t = siblings[i]
                let tags = t.tags
                let logValue = 0
                let logLikelihood = 0
                for (let j = 0; j < tags.length; ++j) {
                    let tag = tags[j]
                    let match = tag.name.match(/^p([.0-9]+)$/)
                    if (match) {
                        logValue = parseFloat(match[1])
                    } else {
                        match = tag.name.match(/^e([.0-9]+)$/)
                        if (match) {
                            logLikelihood = -parseFloat(match[1])
                        }
                    }
                }
                let cost = Math.max(1, t.estimatedMinutes || 1)
                let id = t.id.primaryKey
                bcrMap[id] = Math.pow(10, logValue + logLikelihood) / cost
            }
            siblings.sort((a, b) => {
                return bcrMap[b.id.primaryKey] - bcrMap[a.id.primaryKey]
            })
        })
    }

    lib.parseTaskParams = (task) => {
        let params = {...lib.defaultTaskParams}

        let note = task.note
        if (!note.startsWith('-')) {
            return params
        }

        let lineBreakIndex = note.indexOf("\n")
        if (lineBreakIndex >= 0) {
            note = note.substring(0, lineBreakIndex)
        }
        for (let p of note.split(",")) {
            let match = p.match(/\b(\w+)\s*:\s*(\S+)\b/)
            if (match) {
                let key = match[1]
                let value = match[2]
                if (parsers[key] === undefined) {
                    console.log(`Warning: Unknown prop key ${key} found on task ${task.name}`)
                    continue
                }
                let parsedValue = parsers[key](value)
                if (parsedValue === undefined) {
                    console.log(`Warning: Invalid value ${parsedValue} for key ${key} found on task ${task.name}`)
                    continue
                }
                params[key] = parsedValue
            } else {
                console.log(`Warning: Unknown prop ${p} found on task ${task.name}`)
            }
        }
        return params
    }

    lib.saveTaskParams = (task, taskParams) => {
        let paramStrings = []
        for (let key in taskParams) {
            if (!taskParams.hasOwnProperty(key)) {
                continue
            }
            let value = taskParams[key]
            let defaultValue = lib.defaultTaskParams[key]
            if (value !== defaultValue) {
                paramStrings.push(`${key}: ${value}`)
            }
        }
        let paramLine = paramStrings.length > 0 ? `- ${paramStrings.join(', ')}` : ''
        let note = task.note
        if (note.startsWith('-')) {
            let lineBreakIndex = note.indexOf("\n")
            if (lineBreakIndex >= 0) {
                if (paramStrings.length > 0) {
                    note = `${paramLine}${note.substring(lineBreakIndex)}`
                } else {
                    note = `${note.substring(lineBreakIndex + 1)}`
                }
            } else {
                note = paramLine
            }
        } else {
            if (paramStrings.length > 0) {
                note = `${paramLine}\n${note}`
            }
        }

        task.note = note
    }

    lib.isUsingCFS = (task, queuesFolder, taskParams) => {
        if (!task) return false

        if (!queuesFolder) queuesFolder = lib.getQueuesFolder()

        if (task instanceof Folder) {
            return queuesFolder === task
        }
        if (!taskParams) {
            taskParams = lib.parseTaskParams(task)
        }
        return taskParams.scheduler === 'cfs'
    }

    lib.getSelectedTasks = (selection) => {
        let selected = []
        for (let task of selection.projects) {
            selected.push(task)
        }
        for (let task of selection.tasks) {
            selected.push(task)
        }
        return selected
    }

    lib.formatMinutes = (minutes) => {
        const h = Math.floor(minutes / 60)
        const m = minutes - h * 60
        if (h === 0) return `${m}m`
        if (m === 0) return `${h}h`
        return `${h}h ${m}m`
    }

    lib.getParent = (task) => {
        if (task instanceof Project) {
            return task.parentFolder
        }
        if (task instanceof Task) {
            let result = task.parent
            if (result && result.project) return result.project
            return result
        }
        return undefined
    }

    return lib;
})();
