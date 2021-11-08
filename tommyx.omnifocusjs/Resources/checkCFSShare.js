(() => {
    let action = new PlugIn.Action(function (selection, sender) {
        const {
            getQueuesFolder,
            isTaskCompletedOrDropped,
            parseTaskParams,
            isUsingCFS,
            formatMinutes,
        } = this.common

        let isIncompleteTask = (task) => {
            return !isTaskCompletedOrDropped(task.taskStatus)
        }

        let queuesFolder = getQueuesFolder()
        let data = []
        let totalWeight = 0

        if (queuesFolder.projects.length === 0) {
            new Alert("No queues", "No CFS queues found.").show()
            return
        }

        let dfs = (prefix, totalShare, siblings) => {
            let totalWeight = 0
            for (let t of siblings) {
                let tParams = parseTaskParams(t)
                totalWeight += tParams.weight
            }
            for (let t of siblings) {
                let tParams = parseTaskParams(t)
                let name = prefix + "/" + t.name
                let share = totalShare * tParams.weight / totalWeight
                data.push({
                    name: name,
                    share: share,
                })
                if (isUsingCFS(t, queuesFolder, tParams)) {
                    dfs(name, share, t.children.filter(isIncompleteTask))
                }
            }
        }

        dfs("", 1, queuesFolder.projects.filter(isIncompleteTask))

        const totalHours = 40;
        let text = [`For every ${totalHours} hours:`]
        for (let d of data) {
            let share = Math.round(d.share * 1000) / 10
            text.push(`${d.name}    ${share}% (${formatMinutes(Math.round(d.share * totalHours * 60))})`)
        }
        new Alert("CFS Shares", text.join("\n")).show()
    });

    action.validate = function (selection, sender) {
        const lib = this.common

        let queuesFolder = lib.getQueuesFolder()
        if (!queuesFolder) return false
        return true
    };

    return action;
})();
