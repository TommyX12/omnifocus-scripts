(() => {
    let action = new PlugIn.Action(function (selection, sender) {
        const lib = this.common

        let isIncompleteTask = (task) => {
            return !lib.isTaskCompletedOrDropped(task.taskStatus)
        }

        let queuesFolder = lib.getQueuesFolder()

        let dfs = (parent) => {
            let scheduler = 'none'
            if (parent instanceof Folder) {
                scheduler = 'cfs'
            } else {
                scheduler = lib.parseTaskParams(parent).scheduler
            }
            switch (scheduler) {
                case 'cfs':
                    lib.cfsSort(parent)
                    break
                case 'bcr':
                    lib.bcrSort(parent)
                    break
            }
            let children = (parent instanceof Folder) ? parent.projects : parent.children
            children.filter(isIncompleteTask).map(dfs)
        }

        dfs(queuesFolder)
    });

    action.validate = function (selection, sender) {
        const lib = this.common

        let queuesFolder = lib.getQueuesFolder()
        if (!queuesFolder) return false
        return true
    };

    return action;
})();
