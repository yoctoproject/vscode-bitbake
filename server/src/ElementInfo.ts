/* --------------------------------------------------------------------------------------------
* Copyright (c) Eugen Wiens. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.
* ------------------------------------------------------------------------------------------ */
'use strict';



export type LayerInfo = {
    name: string,
    path: string,
    priority: number
};


export type PathInfo = {
    root: string,
    dir: string,
    base: string,
    ext: string,
    name: string
};


export type ElementInfo = {
    name: string,
    extraInfo ? : string,
    path ? : PathInfo,
    layerInfo ? : LayerInfo,
    appends ? : PathInfo[],
    overlayes ? : PathInfo[],
    version ? : string
};