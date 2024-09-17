/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'
import { logger } from '../lib/src/utils/OutputLogger'

export function loadJsonFile (path: string): unknown {
  try {
    if (!fs.existsSync(path)) {
      return {}
    }
    return JSON.parse(fs.readFileSync(path, 'utf-8'))
  } catch (e) {
    throw new Error(`Error while reading JSON file ${path}: ${e}`)
  }
}

export function saveJsonFile (path: string, json: unknown): void {
  fs.writeFileSync(path, JSON.stringify(json, null, 2), 'utf-8')
}

export function setJsonProperty (json: unknown, property: string, value: unknown): unknown {
  if (typeof json !== 'object' || json === null) {
    logger.warn('[setJsonProperty] json is not an object')
    return
  }
  const typedJson = json as Record<string, unknown>
  if (value === undefined && property in json) {
    // We want to make sure undefined workspace properties are kept as undefined
    // Warning: this will not work if the property is not a string
    typedJson[property] = ''
    return json
  }
  typedJson[property] = value
  return json
}

/// Merge tasks with the same label
export function mergeJsonArray (tasks: unknown[], newTasks: unknown[]): unknown[] {
  for (const newTask of newTasks) {
    if (typeof newTask !== 'object' || newTask === null || !('label' in newTask)) {
      tasks.push(newTask)
      continue
    }
    let found = false
    for (const task of tasks) {
      if (typeof task !== 'object' || task === null || !('label' in task)) {
        continue
      }
      if (task.label === newTask.label) {
        found = true
        Object.assign(task, newTask)
        for (const key in task) {
          if (!(key in newTask)) {
            delete (task as Record<string, unknown>)[key]
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
