#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const cwd = process.cwd();
const configPath = path.resolve(process.cwd(), '.linkrc.json');
const config = require(configPath);

const argv = require('yargs')
  .usage("Example: yarn easylink --reset")
  .help()
  .option('dev', {
    alias: 'd',
    describe: 'Setup block development environment',
    boolean: true,
    default: true,
  })
  .option('reset', {
    alias: 'r',
    describe: 'Reset block to production mode',
    boolean: true,
  })
  .argv;

const { dev, reset } = argv;
const defaultWorkspace = ['.'];
const resolveModulePath = (name, workspace) => {
  return path.resolve(workspace, 'node_modules', name);
};
const formatPrjPath = (prjPath) => {
  if (path.isAbsolute(prjPath)) {
    return prjPath;
  }
  return path.resolve(cwd, prjPath);
};

function hasModule(modulePath) {
  try {
    fs.readdirSync(modulePath);
  } catch(e) {
    return false;
  }
  return true;
}

function isModuleLinked(modulePath) {
  const stat = fs.lstatSync(modulePath);
  return stat.isSymbolicLink();
}

async function link() {
  const modules = Object.keys(config);
  const length = modules.length;
  for (let i = 0; i < length; i += 1) {
    const name = modules[i];
    const {
      localPath,
      workspace,
    } = config[name];
    await linkModule(name, localPath, workspace);
  }
  linkDone();
}

async function linkModule(name, localPath, workspace = ['.']) {
  const spinner = ora(`Register module ${name}...`).start();
  await exec('yarn link', {
    cwd: localPath,
  });
  spinner.succeed(`${name} registered.`);
  const length = workspace.length;
  for (let i = 0; i < length; i += 1) {
    const projectPath = formatPrjPath(workspace[i]);
    const modulePath = resolveModulePath(name, projectPath);
    try {
      const spinner = ora(`Link module ${name} in ${projectPath}...`).start();
      await exec(`yarn link ${name}`, {
        cwd: projectPath,
      });
      spinner.succeed(`${name} in ${projectPath} is now linked to '${localPath}'.`);
    } catch(e) {
      spinner.fail();
      throw e;
    }
  }
}

async function reinstall() {
  // Setup mappings between workspace and modules to reinstall.
  const workspaceModuleMap = {};
  const modules = Object.keys(config);
  modules.forEach(name => {
    const { workspace: workspaceConfigured } = config[name];
    const workspace = workspaceConfigured || defaultWorkspace;
    workspace.map(projectPath => {
      const modulesToReinstall = workspaceModuleMap[projectPath];
      if (!modulesToReinstall) {
        workspaceModuleMap[projectPath] = [name];
        return;
      }
      if (!modulesToReinstall.includes(name)) {
        modulesToReinstall.push(name);
      }
    });
  });

  // Reinstall modules.
  const workspace = Object.keys(workspaceModuleMap);
  const length = workspace.length;
  for (let i = 0; i < length; i += 1) {
    const projectPath = workspace[i];
    const formattedPath = formatPrjPath(projectPath);
    const modulesInProject = workspaceModuleMap[projectPath];
    const notInstalledModules = modulesInProject.filter(name => {
      const modulePath = resolveModulePath(name, formattedPath);
      return !hasModule(modulePath);
    });
    if (notInstalledModules.length === 0) continue;
    const spinner = ora(`Reinstall modules in ${formattedPath}...`).start();
    try {
      await exec('yarn', {
        cwd: projectPath,
      });
      spinner.succeed(`Module reinstalled in ${formattedPath}.`);
    } catch(e) {
      spinner.fail();
      throw e;
    }
  }
}

function linkDone() {
  console.log(chalk.green('Link modules done.'));
}

function unlinkDone() {
  console.log(chalk.green('Unlink modules done.'));
}

async function unlink() {
  const modules = Object.keys(config);
  const length = modules.length;
  for (let i = 0; i < length; i += 1) {
    const name = modules[i];
    const {
      localPath,
      workspace,
    } = config[name];
    await unlinkModule(name, localPath, workspace);
  }
  await reinstall();
  unlinkDone();
}

async function unlinkModule(name, localPath, workspace = ['.']) {
  const length = workspace.length;
  for (let i = 0; i < length; i += 1) {
    const projectPath = formatPrjPath(workspace[i]);
    const modulePath = resolveModulePath(name, projectPath);
    if (!hasModule(modulePath)) {
      console.warn(`${chalk.yellow('[WARNING]')}: '${name}' in ${projectPath} does not exist.`);
      continue;
    }
    if (!isModuleLinked(modulePath)) {
      console.warn(`${chalk.yellow('[WARNING]')}: ${name} in ${projectPath} is not linked.`);
      continue;
    }

    const spinner = ora(`Unlink module ${name} in ${projectPath}...`).start();
    try {
      await exec(`yarn unlink ${name}`, {
        cwd: projectPath,
      });
      spinner.succeed(`${name} in ${projectPath} is now unlinked.`);
    } catch(e) {
      spinner.fail();
      throw e;
    }
  }

  const unlinkSpinner = ora(`Unregister module ${name}...`).start();
  try {
    await exec('yarn unlink', {
      cwd: localPath,
    });
    unlinkSpinner.succeed(`${name} unregistered.`);
  } catch(e) {
    unlinkSpinner.fail();
    throw e;
  }
}

// Reset block to production mode
if (reset) {
  return unlink();
}

link();
