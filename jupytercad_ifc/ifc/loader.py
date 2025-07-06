#TODO Fix

import base64
import tempfile
import os
import ifcopenshell
from typing import Dict, List, Any

class IFC:
    """
    A loader class for reading and writing IFC files in JupyterCAD-like format.
    """
    def __init__(self):
        self._sources: str = ""            # Base64-encoded IFC file content
        self._objects: List[Dict[str, Any]] = []  # Geometry + properties
        self._metadata: Dict[str, Any] = {}  # IFC metadata (e.g. project info)

    def load(self, base64_content: str):
        """
        Load an IFC file from a base64 string, parse it with ifcopenshell,
        and extract geometry and properties.

        Args:
            base64_content: IFC file content encoded as base64
        """
        # Decode and write to temporary .ifc file
        self._sources = base64_content
        data = base64.b64decode(base64_content)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        # Open IFC file
        model = ifcopenshell.open(tmp_path)

        # Extract metadata (e.g. project name, author)
        project = model.by_type('IfcProject')
        if project:
            proj = project[0]
            self._metadata = {
                'name': proj.Name,
                'long_name': getattr(proj, 'LongName', None),
                'description': getattr(proj, 'Description', None)
            }

        # Extract geometry and properties for elements
        self._objects = []
        for entity in model.by_type('IfcBuildingElement'):
            obj = self._ifc_entity_to_object(entity)
            self._objects.append(obj)

        # Clean up temp file
        os.remove(tmp_path)

    def _ifc_entity_to_object(self, entity) -> Dict[str, Any]:
        """
        Convert a single IFC entity to a JSON-serializable object dict.
        """
        # Basic properties
        obj = {
            'id': entity.GlobalId,
            'type': entity.is_a(),
            'name': getattr(entity, 'Name', None),
            'parameters': {}
        }

        # Collect simple attributes
        for attr in entity.attribute_names():
            value = getattr(entity, attr)
            if value is None:
                continue
            # Skip geometry for now; handle later if needed
            if isinstance(value, (str, float, int, bool)):
                obj['parameters'][attr] = value

        return obj

    def save(self, objects: List[Dict[str, Any]], metadata: Dict[str, Any]) -> None:
        """
        Update the IFC model with modified objects and metadata, then return
        a new base64-encoded IFC file.

        Args:
            objects: Modified object list
            metadata: Modified metadata

        Returns:
            Base64-encoded IFC content
        """
        # Decode original and write to temp
        data = base64.b64decode(self._sources)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ifc") as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        model = ifcopenshell.open(tmp_path)

        # TODO: apply metadata updates to model.ByType('IfcProject')[0]

        # TODO: iterate objects and update entity attributes in model

        # Write updated model back to file
        out_path = tmp_path.replace('.ifc', '_updated.ifc')
        model.write(out_path)

        # Read and encode
        with open(out_path, 'rb') as f:
            encoded = base64.b64encode(f.read()).decode('utf-8')

        # Clean up
        os.remove(tmp_path)
