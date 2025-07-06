import {
  ICollaborativeDrive,
  SharedDocumentFactory
} from '@jupyter/collaborative-drive';
import {
  IAnnotationModel,
  IJCadWorkerRegistry,
  JupyterCadDoc,
  IJCadWorkerRegistryToken,
  IJCadExternalCommandRegistry,
  IJCadExternalCommandRegistryToken
} from '@jupytercad/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IThemeManager,
  showErrorMessage,
  WidgetTracker
} from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';

import { JupyterCadWidgetFactory } from '@jupytercad/jupytercad-core';
import {
  IAnnotationToken,
  IJupyterCadDocTracker,
  IJupyterCadWidget
} from '@jupytercad/schema';
import { requestAPI } from '@jupytercad/base';
import { JupyterCadIFCModelFactory } from './modelfactory';
import ifcIconSvg from '../style/ifc.svg';

const ifcIcon = new LabIcon({
  name: 'jupytercad:stp',
  svgstr: ifcIconSvg
});

const FACTORY = 'Jupytercad IFC Factory';

const activate = async (
  app: JupyterFrontEnd,
  tracker: WidgetTracker<IJupyterCadWidget>,
  themeManager: IThemeManager,
  annotationModel: IAnnotationModel,
  drive: ICollaborativeDrive,
  workerRegistry: IJCadWorkerRegistry,
  externalCommandRegistry: IJCadExternalCommandRegistry
): Promise<void> => {
  const ifcCheck = await requestAPI<{ installed: boolean }>(
    'jupytercad_ifc/backend-check',
    {
      method: 'POST',
      body: JSON.stringify({
        backend: 'IfcOpenShell'
      })
    }
  );
  const { installed } = ifcCheck;
  const backendCheck = () => {
    if (!installed) {
      showErrorMessage(
        'IfcOpenShell is not installed',
        'IfcOpenShell is required to open ifc files'
      );
    }
    return installed;
  };
  const widgetFactory = new JupyterCadWidgetFactory({
    name: FACTORY,
    modelName: 'jupytercad-ifcmodel',
    fileTypes: ['ifc'],
    defaultFor: ['ifc'],
    tracker,
    commands: app.commands,
    workerRegistry,
    externalCommandRegistry,
    backendCheck
  });

  // Registering the widget factory
  app.docRegistry.addWidgetFactory(widgetFactory);

  // Creating and registering the model factory for our custom DocumentModel
  const modelFactory = new JupyterCadIFCModelFactory({ annotationModel });
  app.docRegistry.addModelFactory(modelFactory);
  // register the filetype
  app.docRegistry.addFileType({
    name: 'ifc',
    displayName: 'ifc',
    mimeTypes: ['application/octet-stream'],
    extensions: ['.ifc', 'ifc'],
    fileFormat: 'base64',
    contentType: 'ifc',
    icon: ifcIcon
  });

  const ifcSharedModelFactory: SharedDocumentFactory = () => {
    return new JupyterCadDoc();
  };
  drive.sharedModelFactory.registerDocumentFactory(
    'ifc',
    ifcSharedModelFactory
  );

  widgetFactory.widgetCreated.connect((sender, widget) => {
    widget.title.icon = ifcIcon;
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    themeManager.themeChanged.connect((_, changes) =>
      widget.context.model.themeChanged.emit(changes)
    );

    tracker.add(widget);
    app.shell.activateById('jupytercad::leftControlPanel');
    app.shell.activateById('jupytercad::rightControlPanel');
  });
  console.log('jupytercad:ifcplugin is activated!');
};

export const ifcplugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytercad:ifcplugin',
  requires: [
    IJupyterCadDocTracker,
    IThemeManager,
    IAnnotationToken,
    ICollaborativeDrive,
    IJCadWorkerRegistryToken,
    IJCadExternalCommandRegistryToken
  ],
  autoStart: true,
  activate
};
