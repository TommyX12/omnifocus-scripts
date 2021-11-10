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

        if (queuesFolder.projects.length === 0) {
            new Alert("No queues", "No CFS queues found.").show()
            return
        }

        let dfs = (prefix, accumulatedWaitMinutes, siblings) => {
            if (siblings.length <= 0) return

            siblings = siblings.map(t => {
                let tParams = parseTaskParams(t)
                return {t, tParams}
            })
            siblings.sort((a, b) => a.tParams.vruntime - b.tParams.vruntime)
            let waitMinutes = accumulatedWaitMinutes
            let minutesPerVruntime = 0
            let lastVruntime = siblings[0].tParams.vruntime
            for (let {t, tParams} of siblings) {
                let name = prefix + "/" + t.name
                waitMinutes += (tParams.vruntime - lastVruntime) * minutesPerVruntime
                data.push({
                    name: name,
                    waitMinutes: waitMinutes,
                })
                if (isUsingCFS(t, queuesFolder, tParams)) {
                    dfs(name, waitMinutes, t.children.filter(isIncompleteTask))
                }
                minutesPerVruntime += tParams.weight
                lastVruntime = tParams.vruntime
            }
        }

        dfs("", 0, queuesFolder.projects.filter(isIncompleteTask))

        const totalHours = 40;
        let text = []
        for (let d of data) {
            text.push(`${d.name}    ${formatMinutes(Math.round(d.waitMinutes))}`)
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
