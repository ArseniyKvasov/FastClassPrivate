import React from "react";
import ReactDOM from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export function mountExcalidraw(container, initialData, onChange) {
    const root = ReactDOM.createRoot(container);

    root.render(
        <Excalidraw
            initialData={initialData || null}
            onChange={(elements, appState, files) => {
                onChange({
                    elements,
                    appState,
                    files
                });
            }}
        />
    );

    return () => root.unmount();
}

window.ExcalidrawApp = {
    mountExcalidraw
};