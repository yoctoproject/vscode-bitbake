/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'

export function loadJsonFile (path: string): any {
  if (!fs.existsSync(path)) {
    return {}
  }
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

export function saveJsonFile (path: string, json: any): void {
  fs.writeFileSync(path, JSON.stringify(json, null, 2), 'utf-8')
}

export function setJsonProperty (json: any, property: string, value: any): any {
  if (value === undefined) {
    // We want to make sure undefined workspace properties are kept as undefined
    // Warning: this will not work if the property is not a string
    json[property] = ''
    return json
  }
  json[property] = value
  return json
}

/// Merge tasks with the same label
export function mergeJsonArray (tasks: any, newTasks: any): any {
  for (const newTask of newTasks) {
    let found = false
    for (const task of tasks) {
      if (task.label === newTask.label) {
        found = true
        Object.assign(task, newTask)
        for (const key in task) {
          if (!(key in newTask)) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete task[key]
          }
        }
      }
    }
    if (!found) {
      tasks.push(newTask)
    }
  }
  return tasks
}
