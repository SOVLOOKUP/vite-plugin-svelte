import { ModuleGraph, ModuleNode } from 'vite';
import { CompileData } from './compile';
import { PluginContext } from 'rollup';

export async function updateCssModule(
	compileData: CompileData,
	moduleGraph: ModuleGraph,
	pluginContext: PluginContext
) {
	const cssModule = moduleGraph.getModuleById(compileData.cssId);
	const dependencies = compileData.preprocessedDependencies;
	const { cssDeps } = splitIntoJsCss(dependencies);
	await updateModule(moduleGraph, cssModule, cssDeps);
	cssDeps.forEach(pluginContext.addWatchFile);
}

export async function updateJSModule(
	compileData: CompileData,
	moduleGraph: ModuleGraph,
	pluginContext: PluginContext
) {
	const jsModule = moduleGraph.getModuleById(compileData.id);
	const dependencies = compileData.preprocessedDependencies;
	const { jsDeps } = splitIntoJsCss(dependencies);
	await updateModule(moduleGraph, jsModule, jsDeps);
	jsDeps.forEach(pluginContext.addWatchFile);
}

async function updateModule(
	moduleGraph: ModuleGraph,
	mod: ModuleNode | undefined,
	addDependencies: string[],
	removeDependencies?: string[]
) {
	if (!mod || (!addDependencies?.length && !removeDependencies?.length)) {
		return;
	}
	// record deps in the module graph so edits to @import css can trigger
	// main import to hot update
	const newDeps = new Set(
		[...addDependencies].map((file) => moduleGraph.createFileOnlyEntry(file))
	);
	const keepDeps = [...mod.importedModules].filter(
		(dep) => !removeDependencies?.includes(dep.file!)
	);
	const updatedDependencies = new Set([...keepDeps, ...newDeps]);
	const acceptedDeps = new Set([...newDeps, ...mod.acceptedHmrDeps]);
	console.log('updated deps', [...updatedDependencies].map((dep) => dep.id).join('\n'));
	await moduleGraph.updateModuleInfo(mod, updatedDependencies, acceptedDeps, mod.isSelfAccepting);
}

function splitIntoJsCss(dependencies?: string[]): { jsDeps: string[]; cssDeps: string[] } {
	const jsDeps: string[] = [];
	const cssDeps: string[] = [];
	if (dependencies) {
		for (const dep of dependencies) {
			if (isJsDependency(dep)) {
				jsDeps.push(dep);
			} else {
				cssDeps.push(dep);
			}
		}
	}
	return { jsDeps, cssDeps };
}

// preprocessor js dependencies are rare, usually these are added by markup preprocessors
const KNOWN_JS_EXTENIONS = ['.ts', '.js', '.html', '.pug'];
function isJsDependency(dep: string) {
	const ext = dep.slice(dep.lastIndexOf('.'));
	return KNOWN_JS_EXTENIONS.includes(ext);
}
