import * as vscode from 'vscode';

/// Reflects the task definition in package.json
interface BitbakeTaskDefinition extends vscode.TaskDefinition {
	recipes: string[]
  task?: string
  options?: {
    continue: boolean
    force: boolean
  }
}

export class BitbakeTaskProvider implements vscode.TaskProvider {

  provideTasks(token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
    return [];
  }

  resolveTask(task: vscode.Task, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> | undefined {
    if(task.definition) {
      const bitbakeTaskDefinition : BitbakeTaskDefinition = <any>task.definition
      if(bitbakeTaskDefinition.recipes?.[0]) {
        return new vscode.Task(
          bitbakeTaskDefinition,
          task.scope ?? vscode.TaskScope.Workspace,
          `Run bitbake ${bitbakeTaskDefinition.recipes} task ${bitbakeTaskDefinition?.task}`,
          'bitbake',
          new vscode.ShellExecution(`bitbake ${bitbakeTaskDefinition.recipes}`),
          ['$bitbake']
        );
      }
    }
    return undefined
  }
}
