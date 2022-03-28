

const Awesomplete = require(pathModule.join(window.api.getAppPath(), "app", "awesomplete", "awesomplete.js"));
const Geometry = require("./mappingTool/geometry");
const MapLibrary = require("./mappingTool/mapLibrary");
var mapLibrary = new MapLibrary();
const SlideCanvas = require("./mappingTool/slideCanvas");
const Menu = require("./mappingTool/menu");
const TokenDialog = require("./mappingTool/tokenDialog");
const tokenDialog = new TokenDialog();
const Timer = require("./js/timer");
const Recents = require("./mappingTool/recents");
var recentMaps = new Recents();
const SoundManager = require("./js/soundManager")
const soundManager = new SoundManager();
const dataAccess = require("./js/dataaccess");
const sidebarManager = require("./js/sidebarManager");
const InfoTooltip = require("./mappingTool/infotooltip");
const info = new InfoTooltip();
const initiative = require("./js/initiative");
const marked = require('marked');
const TokenSelector = require('./js/tokenSelector');
const tokenSelector = new TokenSelector();
const saveManager = require("./mappingTool/saveManager");
const effectManager = require('./mappingTool/effectManager');

soundManager.initialize();


var conditionList;


var frameHistoryButtons = null;
var pendingMapLoad;


function loadSettings() {
    dataAccess.getSettings(function (data) {

        settings = data.maptool;

        if (!settings.colorTokenBases) {
            document.getElementById("background_color_button_add_pawn").value = "rgba(255, 255, 255, 0)";
        }

        var hueSelector = document.getElementById("fog_of_war_hue_selector")
        if (settings.fogOfWarHue) {
            hueSelector.value = settings.fogOfWarHue;
        } else {
            settings.fogOfWarHue = hueSelector.value;
        }
        if (!settings.transparentWindow) document.body.style.backgroundColor = hueSelector.value;
        effectFilePath = defaultEffectPath;

        if (!settings.enableGrid) settings.snapToGrid = false;
        if (!settings.applyDarkvisionFilter) {
            setBackgroundFilter();
        } else {
            if (fovLighting.viewerHasDarkvision()) {
                setBackgroundFilter();
            }
        }
        var filterValue = settings.currentFilter ? settings.currentFilter : 0;
        var filterDd = document.getElementById("filter_tool");
        filterDd.selectedIndex = parseInt(filterValue);
        setBackgroundFilter();
        if (settings.currentMap) {
            setMapForeground(settings.currentMap, settings.gridSettings.mapSize);
        }

        if (settings.currentOverlay) {
            setMapOverlay(settings.currentOverlay, settings.gridSettings.mapOverlaySize);
        }

        if (settings.currentBackground) {
            setMapBackground(settings.currentBackground, settings.gridSettings.mapBackgroundSize);
        }
        if (settings.transparentWindow) {
            document.querySelector(".maptool_body").style.backgroundImage = null;
        } else if (settings.map_edge_style) {
            document.querySelector(".maptool_body").style.backgroundImage = "url('" + settings.map_edge_style + "')";
        }
        if (!partyArray)
            loadParty();
        onSettingsLoaded();
    });
}



function saveSettings() {
    dataAccess.getSettings(function (data) {
        data.maptool = settings;
        dataAccess.saveSettings(data);

    });
}

function switchActiveViewer() {
    fovLighting.toggleDarkvision();
    refreshFogOfWar();
    setBackgroundFilter();

}

// #region commands
function notifySelectedPawnsChanged() {
    window.api.messageWindow('mainWindow', 'notify-maptool-selection-changed',
        { selected: selectedPawns.filter(x => x.index_in_main_window).map(x => x.index_in_main_window) });

    updateHowlerListenerLocation();
}


function notifyTokenAdded(tokenIndex, name) {
    window.api.messageWindow('mainWindow', 'notify-token-added-in-maptool', [tokenIndex, name]);
}

function requestNotifyUpdateFromMain() {
    window.api.messageWindow('mainWindow', 'update-all-pawns');
}


function reloadMap() {
    if (pawns.all.length > pawns.players.length && !window.confirm("Do you wish to reload the window?"))
        return;
    location.reload();
}
document.addEventListener("DOMContentLoaded", function () {

    loadSettings();
    updateHowlerListenerLocation();
    window.api.messageWindow('mainWindow', 'maptool-initialized')

    var bgSize = parseInt($("#foreground").css("background-size"));
    var slider = document.getElementById("foreground_size_slider");
    slider.value = bgSize;

    //Drag drop
    document.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log(event.dataTransfer.files)
        if (event.dataTransfer.files?.length > 0) {
            var f = event.dataTransfer.files[0];

            var path = f.path;
            var extension = pathModule.extname(path).replaceAll(".", "");

            if (saveManager.supportedMapTypes().includes(extension))
                saveManager.loadMapFromPath(path);

        }

    });
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });



    $("#background_color_button_add_pawn").spectrum({
        preferredFormat: "rgb",
        allowEmpty: false,
        showAlpha: true,
        showInput: true
    });
    $("#background_color_button_change_pawn").spectrum({
        preferredFormat: "rgb",
        allowEmpty: false,
        showAlpha: true,
        showInput: true,
        chooseText: "Set as base",
        cancelText: "Cancel",
        change: pawnBgColorChosen
    });

    function pawnBgColorChosen(color) {
        newColor = color;
        selectedPawns.forEach(element => element.style.backgroundColor = newColor);
    }



    dataAccess.getConditions(function (data) {

        data.sort(function (a, b) {
            if (a.name < b.name) return -1;
            if (b.name < a.name) return 1;
            return 0;
        });
        conditionList = data;
        var parentNode = document.getElementById("conditions_menu");
        var newButton = document.createElement("button");
        newButton.classList.add("button_style");
        newButton.onclick = removeAllConditionsHandler;
        newButton.innerHTML = "Clear all";
        parentNode.appendChild(newButton);
        var input = parentNode.querySelector(".conditions_menu_input");
        var list = conditionList.map(x => x.name).sort();
        new Awesomplete(input, { list: list, autoFirst: true, minChars: 0, maxItems: 25 })
        input.addEventListener('awesomplete-selectcomplete', function (e) {
            var condition = e.text.value;
            input.value = "";

            var condition = conditionList.find(c => c.name == condition);
            createConditionButton(condition.name)
            selectedPawns.forEach(function (pawn) {
                setPawnCondition(pawn, condition);
                raiseConditionsChanged(pawn);
            });
        });

    });

    tokenDialog.initialize();

});

function centerForegroundOnBackground() {

    var bgRect = backgroundCanvas.getBoundingClientRect();
    var foregroundRect = foregroundCanvas.getBoundingClientRect();
    var mapContainer = mapContainers[0];
    var middleX = (bgRect.width / mapContainer.data_bg_scale) / 2;
    var middleY = (bgRect.height / mapContainer.data_bg_scale) / 2;

    var newX = middleX - (foregroundRect.width / 2) / mapContainer.data_bg_scale;
    var newY = middleY - (foregroundRect.height / 2) / mapContainer.data_bg_scale;
    moveForeground(newX, newY);
}


function resetEverything() {
    if (currentlyDeletingSegments)
        document.getElementById("delete_segments_button").click();
    clearSelectedPawns();
    hideAllTooltips();
    effectManager.close();
    if (document.getElementById("move_effects_button").getAttribute("toggled") != "false")
        document.getElementById("move_effects_button").click();
    gridLayer.onmousedown = generalMousedowngridLayer;
    gridLayer.style.cursor = "auto";
    return turnAllToolboxButtonsOff();
}

function onSettingsChanged() {
    if (settings.roundTimer) {
        if (roundTimer) {
            roundTimer.destroy();
        }
        roundTimer = new Timer(settings.roundTimer);
        roundTimer.render();
    }
}

function onSettingsLoaded() {


    console.log("Settings loaded");
    resizeForeground(settings.defaultMapSize ? settings.defaultMapSize : settings.gridSettings.mapSize ? settings.gridSettings.mapSize : window.innerWidth);
    map.init();
  
    recentMaps.initialize(document.querySelector("#recent_maps_button>ul"));
    mapLibrary.initialize();
    Menu.initialize();

    effectManager.initialize();
    onSettingsChanged();

    document.querySelector("body").onkeydown = function (event) {
        var keyIndex = [37, 38, 39, 40, 65, 87, 68, 83].indexOf(event.keyCode);

        var lastKey = LAST_KEY;
        LAST_KEY = event.key;
        window.clearTimeout(lastKeyNull)
        lastKeyNull = window.setTimeout(() => LAST_KEY = "", 1000);

        if (event.key === "Escape") {
            return resetEverything;
            //Show global listener position
        } else if (event.key.toLowerCase() == "p" && lastKey.toLowerCase() == "l") {
            return soundManager.displayGlobalListenerPosition();
        } else if (event.key.toLowerCase() == "e" && lastKey.toLowerCase() == "d") {
            if (currentlyDeletingSegments) return;
            document.getElementById("delete_segments_button").click();
        } else if (event.ctrlKey && event.key.toLowerCase() == "s") {
            return saveManager.saveCurrentMap();
        } else if (event.ctrlKey && event.key.toLowerCase() == "o") {
            return saveManager.loadMapDialog();
        } else if (keyIndex < 0 || (keyIndex > 3 && pauseAlternativeKeyboardMoveMap)) {
            return;
        }
        window.clearInterval(resetMoveIncrementTimer);
        resetMoveIncrementTimer = window.setTimeout(function () {
            canvasMoveRate = 2;
        }, 600)

        var container = mapContainers[0];
        var bgX = container.data_transform_x;
        var bgY = container.data_transform_y;

        if (event.shiftKey) {
            bgX = foregroundCanvas.data_transform_x;
            bgY = foregroundCanvas.data_transform_y;
            if (event.keyCode == 37) {
                bgX -= canvasMoveRate;
            } else if (event.keyCode == 39) {
                bgX += canvasMoveRate;
            } else if (event.keyCode == 38) {
                bgY -= canvasMoveRate;
            } else if (event.keyCode == 40) {
                bgY += canvasMoveRate;
            }

            moveForeground(bgX, bgY)

            if (canvasMoveRate < 80) canvasMoveRate++;
            return;
        }
        //Normal read map handlers
        map.onkeydown(event);
    }

    gridLayer.onwheel = function (event) {
        event.preventDefault();
        if (event.ctrlKey && previewPlacementElement) {
            effectManager.onPreviewPlacementResized(event);
        }

        return map.onzoom(event);
    };

    document.getElementById("clear_foreground_button").onclick = function (e) {
        setMapForeground(null);
        settings.currentMap = null;
        settings.gridSettings.mapSize = null;
        saveSettings();
    };


    var iconLoadButtons = [...document.querySelectorAll(".icon_load_button")];
    iconLoadButtons.forEach(button => {
        button.onclick = setTokenImageHandler;
    })
    document.getElementById("next_facet_button").onclick = setTokenNextFacetHandler;

    initialLoadComplete = true;
    if (pendingMapLoad) {
        saveManager.loadMapFromPath(pendingMapLoad);
        pendingMapLoad = null;
    }
}

function getMapImageFromDialog() {
    return window.dialog.showOpenDialogSync({
        properties: ['openFile'],
        message: "Choose map",
        filters: [{ name: 'Images', extensions: constants.imgFilters }]
    })[0].replace(/\\/g, "/");
}

function getBackgroundFromFile(e) {
    var path = getMapImageFromDialog();
    if (path) {
        setMapBackground(path, settings.defaultMapSize);
    }
};

function getOverlayFromFile(e) {
    var path = getMapImageFromDialog();
    if (path) {
        setMapOverlay(path, settings.defaultMapSize);
    }
}

function getForegroundFromFile(e) {
    var path = getMapImageFromDialog();
    if (path) {
        setMapForeground(path, settings.defaultMapSize);
        settings.currentMap = path;
        settings.gridSettings.mapSize = null;
        saveSettings();
    }
};


function setMapOverlay(path, width) {
    var btn = document.getElementById("overlay_button");
    settings.currentOverlay = path;
    if (!path) {
        console.log("Clear overlays")
        overlayCanvas.style.backgroundImage = 'none';
        btn.innerHTML = "Image";
        return;
    }
    if (settings.matchSizeWithFileName) {
        width = getMapWidthFromFileName(path, width);
    }
    btn.innerHTML = pathModule.basename(path);
    overlayCanvas.style.backgroundImage = 'url("' + path + '")';
    var img = new Image();
    settings.gridSettings.mapOverlaySize = width;
    img.onload = function () {
        overlayCanvas.heightToWidthRatio = img.height / img.width;
        resizeOverlay(width ? width : img.width);
    }
    img.src = path;
    serverNotifier.notifyServer("overlay", { path: path, width: width });
}

function getMapWidthFromFileName(path, width) {
    var basename = pathModule.basename(path);
    var idx = basename.lastIndexOf("[");
    var idx2 = basename.indexOf("]", idx);

    if (idx < 0 || idx2 < 0) return width;
    var str = basename.substring(idx, idx2);
    str = str.replace("[", "").replace("]", "");
    var whArr = str.split("x");
    return parseInt(whArr[0]) * cellSize || width;
}

var saveTimer;
function toggleSaveTimer() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(
        function () {
            settings.gridSettings = {}
            settings.gridSettings.cellSize = cellSize;
            settings.gridSettings.mapSize = parseFloat($("#foreground").css("width"));
            settings.gridSettings.mapBackgroundSize = parseFloat($("#background").css("width"));
            settings.gridSettings.mapOverlaySize = parseFloat($("#overlay").css("width"));
            saveSettings();
        }, 7000
    );
}


function generalMousedowngridLayer(event) {

    if (event.button == 2) {
        clearSelectedPawns();
        showPopupMenuGeneral(event.x, event.y);
    } else if (event.button == 0) {
        clearSelectedPawns();
        if (event.ctrlKey) {
            clearSelectedPawns();
            startSelectingPawns(event);
        } else {
            startMovingMap(event);
        }

    } else if (event.button == 1) {
        startMovingMap(event);
    }
}

var GLOBAL_MOUSE_DOWN = false;
function recordMouseDown() {
    document.addEventListener("mousedown", function (e) {
        if (e.button == 1)
            GLOBAL_MOUSE_DOWN = true;
    })

    document.addEventListener("mouseup", function (e) {
        GLOBAL_MOUSE_DOWN = false;
    })
}

var GLOBAL_MOUSE_POSITION;
function recordMouseMove() {
    document.addEventListener("mousemove", recordMouse);
}
function recordMouse(e) {
    GLOBAL_MOUSE_POSITION = { x: e.x, y: e.y };
    if (GLOBAL_MOUSE_DOWN) {
        fovLighting.attemptToDeleteSegment({ x: GLOBAL_MOUSE_POSITION.x, y: GLOBAL_MOUSE_POSITION.y });
    }
}

function drawSegmentsOnMouseMove() {
    document.addEventListener("mousemove", fovLighting.drawSegments)
}



function toggleDeleteSegments() {
    turnAllToolboxButtonsOff();

    gridLayer.style.cursor = "not-allowed";
    currentlyDeletingSegments = !currentlyDeletingSegments;
    if (currentlyDeletingSegments) {
        recordMouseMove();
        drawSegmentsOnMouseMove();
        gridLayer.onmousedown = function (event) {
            if (event.button == 2) {
                var bn = document.getElementById("delete_segments_button")
                bn.click();
                return;
            }

            fovLighting.attemptToDeleteSegment({ x: event.clientX, y: event.clientY });
            refreshFogOfWar();
        };
    } else {
        gridLayer.onmousedown = generalMousedowngridLayer;
        gridLayer.style.cursor = "auto";
        document.removeEventListener("mousemove", recordMouse, false);
        document.removeEventListener("mousemove", fovLighting.drawSegments, false);
    }

}

function turnAllToolboxButtonsOff() {
    var toggleButtons = document.querySelectorAll(".toolbox_button");
    for (var i = 0; i < toggleButtons.length; i++) {
        if (toggleButtons[i].getAttribute("toggled") == "true") {
            toggleButtons[i].click();
        }
    }
    gridLayer.onmousedown = generalMousedowngridLayer;
    currentlyMeasuring = false;
    gridLayer.style.zIndex = 4;
    stopMeasuring(null, true);
}


function snapPawnToGrid(elmnt) {

    var positionOnTranslatedGrid = {
        x: Math.round((elmnt.offsetLeft - gridMoveOffsetX) / cellSize) * cellSize,
        y: Math.round((elmnt.offsetTop - gridMoveOffsetY) / cellSize) * cellSize
    }
    var oldLeft = parseFloat(elmnt.style.left);
    var oldTop = parseFloat(elmnt.style.top);
    var diffX = oldLeft - (positionOnTranslatedGrid.x + gridMoveOffsetX);
    var diffY = oldTop - (positionOnTranslatedGrid.y + gridMoveOffsetY);
    elmnt.style.left = positionOnTranslatedGrid.x + gridMoveOffsetX + "px";
    elmnt.style.top = positionOnTranslatedGrid.y + gridMoveOffsetY + "px";
    if (elmnt.attached_objects)
        elmnt.attached_objects.forEach(obj => {
            var currX = parseFloat(obj.style.left);
            var currY = parseFloat(obj.style.top);
            currX -= diffX;
            currY -= diffY;
            obj.style.left = currX + "px";
            obj.style.top = currY + "px";
        });
}



function showMapSizeSlider(element) {
    var cont = document.getElementById("map_size_slider_container");
    cont.classList.contains("hidden") ? cont.classList.remove("hidden") : cont.classList.add("hidden")


}

function setLightSource(brightLight, dimLight, params) {
    selectedPawns.forEach(function (pawn) {
        if (params && params.darkvision) {
            pawn.sight_mode = "darkvision";
        } else {
            if (params && params.torch) {
                pawn.classList.add("light_source_torch")
            } else {
                pawn.classList.remove("light_source_torch")
            }
            pawn.sight_mode = "normal";

        }
        pawn.sight_radius_bright_light = brightLight;
        pawn.sight_radius_dim_light = dimLight;

        if (pawns.lightSources.indexOf(pawn) >= 0) {
            if (brightLight == 0 && dimLight == 0) {
                if (!isPlayerPawn(pawn))
                    pawns.lightSources.splice(pawns.lightSources.indexOf(pawn), 1);
            }
        } else {
            if (brightLight > 0 || dimLight > 0) {
                pawns.lightSources.push(pawn);
            }
        }

    })



    refreshFogOfWar();
}

function loadParty() {
    if (partyArray == null) partyArray = [];
    if (!settings.addPlayersAutomatically) return;
    dataAccess.getParty(function (data) {
        var newPartyArray = [];
        var alreadyInParty;
        data = data.members;
        for (var i = 0; i < data.length; i++) {
            if (data[i].active) {
                alreadyInParty = false;
                for (var j = 0; j < partyArray.length; j++) {
                    if (data[i].character_name == partyArray[j][0]) {
                        alreadyInParty = true;
                        break;
                    }
                }
                if (!alreadyInParty) {
                    newPartyArray.push(
                        {
                            name: data[i].character_name,
                            id: data[i].id,
                            size: "medium",
                            color: Util.hexToRGBA(data[i].color, 0.4),
                            bgPhoto: null,
                            darkVisionRadius: data[i].darkvision
                        }
                    );
                    partyArray.push([data[i].character_name, "medium"]);
                }

            }
        }


        generatePawns(newPartyArray, false);
        fillForcedPerspectiveDropDown();

    });
}

function fillForcedPerspectiveDropDown() {
    var dropDown = document.getElementById("fov_perspective_dropdown");

    while (dropDown.childNodes.length > 4) {
        dropDown.removeChild(dropDown.lastChild);
    }
    partyArray.forEach(function (array) {
        var option = document.createElement("option");
        option.setAttribute("value", array[0]);
        option.innerHTML = array[0];
        dropDown.appendChild(option);
    })

}


async function setPlayerPawnImage(pawnElement, path) {
    var tokenPath;
    var path = await dataAccess.getTokenPath(path);

    if (path != null) {
        path = path.replace(/\\/g, "/")
        tokenPath = `url('${path}')`;
        pawnElement.getElementsByClassName("token_photo")[0].setAttribute("data-token_facets", JSON.stringify([path]));
    } else {
        tokenPath = " url('mappingTool/tokens/default.png')";
    }

    pawnElement.getElementsByClassName("token_photo")[0].style.backgroundImage = tokenPath;
}

async function setPawnImageWithDefaultPath(pawnElement, path) {
    var tokenPath;
    var possibleNames = [];
    var i = 0;
    while (true) {
        var pawnPath = await dataAccess.getTokenPath(path + i);

        if (pawnPath != null) {
            possibleNames.push(pawnPath);
            i++;
        } else {
            break;
        }
    }

    if (possibleNames.length > 0) {
        tokenPath = "url('" + possibleNames.pickOne().replace(/\\/g, "/") + "')";
    } else {
        tokenPath = " url('mappingTool/tokens/default.png')";
    }

    pawnElement.getElementsByClassName("token_photo")[0].style.backgroundImage = tokenPath;
}

async function setPawnMobBackgroundImages(pawn, path) {
    var possibleNames = [];
    var i = 0;
    while (true) {
        var pawnPath = await dataAccess.getTokenPath(path + i);
        if (pawnPath != null) {
            possibleNames.push(pawnPath);
            i++;
        } else {
            break;
        }
    }

    if (possibleNames.length == 0) {
        possibleNames = ["mappingTool/tokens/default.png"]
    }
    pawn.setAttribute("data-token_paths", JSON.stringify(possibleNames));
    refreshMobBackgroundImages(pawn);
}



function removeAllConditionsHandler(event) {
    selectedPawns.forEach(function (pawn) {
        pawn["data-dnd_conditions"] = [];
        var conditions = [...pawn.getElementsByClassName("condition_effect")];
        while (conditions.length > 0) {
            var condition = conditions.pop();
            condition.parentNode.removeChild(condition);
        }
        hideAllTooltips();
        raiseConditionsChanged(pawn);
    });

}

function removeAllPawnConditions(pawnElement, originMainWindow = false) {
    removePawnConditionHelper(pawnElement, null, true, originMainWindow);
}

function removePawnCondition(pawnElement, conditionString) {
    removePawnConditionHelper(pawnElement, conditionString, false)

}
function removePawnConditionHelper(pawnElement, conditionObj, deleteAll, originMainWindow = false) {

    if (deleteAll) {
        pawnElement["data-dnd_conditions"] = [];
    } else {
        var currentArr = pawnElement["data-dnd_conditions"];
        pawnElement["data-dnd_conditions"] = currentArr.filter(x => { return x != conditionObj.name });
    }

    var allConditions = [...pawnElement.getElementsByClassName("condition_effect")];

    allConditions.forEach(function (condition) {
        if (deleteAll || condition.getAttribute("data-dnd_condition_full_name") == conditionObj.name) {

            condition.parentNode.removeChild(condition);
        }
    });
    if (!originMainWindow)
        raiseConditionsChanged(pawnElement);

}

function raiseConditionsChanged(pawn) {

    var idx = pawn.getAttribute("index_in_main_window");
    window.api.messageWindow('mainWindow', 'condition-list-changed', {
        conditionList: pawn["data-dnd_conditions"],
        index: idx ? idx : pawn.title
    });

}

function removeSelectedPawn() {
    while (selectedPawns.length > 0) {
        removePawn(selectedPawns.pop());
    }


}

function killOrRevivePawn() {
    var btn = document.getElementById("kill_or_revive_button")
    var revivePawn = btn.innerHTML == "Revive";
    for (var i = 0; i < selectedPawns.length; i++) {
        killOrReviveHelper(selectedPawns[i]);
    }
    refreshPawnToolTips();

    function killOrReviveHelper(pawnElement) {
        var isPlayer = isPlayerPawn(pawnElement);

        if (revivePawn) {
            if (pawnElement.dead == "false")
                return;
            pawnElement.dead = "false";
            if (!isPlayer) {
                if (loadedMonstersFromMain.indexOf(pawnElement) >= 0) {
                    window.api.messageWindow('mainWindow', 'monster-revived', { name: pawnElement.dnd_name, index: pawnElement.index_in_main_window });
                }
            }
        } else {
            if (pawnElement.dead == "true")
                return;
            pawnElement.dead = "true";
            if (!isPlayer) {

                if (loadedMonstersFromMain.indexOf(pawnElement) >= 0) {
                    window.api.messageWindow('mainWindow', 'monster-killed', [pawnElement.dnd_name, pawnElement.index_in_main_window]);
                }
            }
        }
        console.log(pawnElement.dead)
        pawnElement.setAttribute("data-state_changed", 1);
    }
}


var addingFromMainWindow = false;
function startAddingFromQueue() {
    var tooltip = document.getElementById("tooltip");
    addingFromMainWindow = true;
    tooltip.classList.remove("hidden");
    tooltip.innerHTML = "Creature #" + pawns.addQueue[0].indexInMain;

    document.onmousemove = function (e) {
        tooltip.style.top = e.clientY - 50 + "px";
        tooltip.style.left = e.clientX + "px";
    }
    gridLayer.style.cursor = "copy";
    gridLayer.onmousedown = function (e) {
        if (e.button == 0) {
            popQueue(e);
        } else {
            stopAddingFromQueue()
        }

    }

    function popQueue(e) {
        var radiusOfPawn = creaturePossibleSizes.hexes[creaturePossibleSizes.sizes.indexOf(pawns.addQueue[0].size)];
        var offset = (radiusOfPawn * cellSize) / 2;

        var pawn = generatePawns([pawns.addQueue[0]], true, { x: e.clientX - offset, y: e.clientY - offset });
        loadedMonstersFromMain.push(pawn);
        requestNotifyUpdateFromMain();
        pawns.addQueue.splice(0, 1);
        if (pawns.addQueue.length == 0) {
            document.getElementById("add_pawn_from_tool_toolbar").classList.add("hidden");
            var button = document.getElementById("add_from_queue_toggle_button");
            button.setAttribute("toggled", "false");
            button.classList.remove("toggle_button_toggled");
            button.classList.add("button_style");

            return stopAddingFromQueue()
        }
        tooltip.innerHTML = "Creature #" + pawns.addQueue[0].indexInMain;


    }

    function stopAddingFromQueue() {
        gridLayer.onmousedown = generalMousedowngridLayer;
        gridLayer.style.cursor = "auto";
        document.onmousemove = null;
        tooltip.classList.add("hidden");
        addingFromMainWindow = false;
    }
}

function setTokenNextFacetHandler(e) {
    selectedPawns.forEach(pawn => {
        var pawnPhoto = pawn.getElementsByClassName("token_photo")[0];
        var images = JSON.parse(pawnPhoto.getAttribute("data-token_facets"));
        var currentIndex = parseInt(pawnPhoto.getAttribute("data-token_current_facet")) || 0;
        currentIndex++;
        if (currentIndex >= images.length) currentIndex = 0;

        setPawnToken(pawn, `url('${images[currentIndex]}')`);
        onBackgroundChanged(pawn);
        pawnPhoto.setAttribute("data-token_current_facet", currentIndex)

    })
}

function onBackgroundChanged(pawn) {
    //Notify clients
}

async function setTokenImageHandler(e) {
    var input = document.getElementById("icon_load_button");
    var facetButton = document.getElementById("add_token_facet_button");

    await tokenSelector.getNewTokenPaths(true, imagePaths => {
        if (imagePaths == null) return;

        if (e.target == input) {
            selectedPawns.forEach(element => setPawnBackgroundFromPathArray(element, imagePaths));
        } else if (e.target == facetButton) {
            selectedPawns.forEach(element => addToPawnBackgrounds(element, imagePaths));
        }
    });
};



function showPopupMenuPawn(x, y) {
    document.getElementById("popup_menu_general").classList.add("hidden");

    var popup = document.getElementById("popup_menu_pawn");
    var killButton = document.getElementById("kill_or_revive_button");
    if (selectedPawns[0].dead == "true") {
        killButton.innerHTML = "Revive";
    } else {
        killButton.innerHTML = "Kill";
    }
    document.getElementById("background_color_button_change_pawn").value = selectedPawns[0].backgroundColor;

    var hasFacets = 1, isMob = -1;
    selectedPawns.forEach(pawn => {
        if (!pawn.querySelector(".token_photo")?.getAttribute("data-token_facets"))
            hasFacets = 0;
        if (pawn.classList.contains("pawn_mob"))
            isMob = 1;
    });
    Util.showOrHide("pawn_token_menu_button", -1 * isMob);
    Util.showOrHide("next_facet_button", hasFacets);


    popup.classList.remove("hidden");
    popup.style.left = x + "px";
    popup.style.top = y + "px";
    document.onclick = function (e) {
        document.getElementById("popup_menu_pawn").classList.add("hidden");
        document.onclick = null;
    }
}

function showPopupDialogAddPawn() {
    pauseAlternativeKeyboardMoveMap = true;
    tokenDialog.show();

}

function hideAllTooltips() {
    Util.showOrHide("vision_tooltip_category", -1);
    Util.showOrHide("tooltip", -1);
    Util.showOrHide("tooltip2", -1);
    Util.showOrHide("popup_menu_add_effect", -1);
    Util.showOrHide("popup_dialogue_add_pawn", -1);
    Util.showOrHide("conditions_menu", -1);
    gridLayer.style.cursor = "auto";

    //clearSelectedPawns();

}
function showLightSourceTooltip(event) {
    Util.showOrHide("vision_tooltip_category", 1);
    var tooltip = document.getElementById("vision_tooltip_category");
    document.getElementById("popup_menu_pawn").classList.add("hidden");
    tooltip.style.left = event.clientX + "px";
    tooltip.style.top = event.clientY + "px";
    window.setTimeout(function () {
        document.onclick = function (event) {
            hideAllTooltips();
            document.onclick = null;
        }

    }, 200)
}

function createConditionButton(condition) {
    var menuWindow = document.getElementById("conditions_menu");
    var btn = document.createElement("button");
    btn.className = "button_style condition_button";
    btn.onclick = function (e) {
        var name = e.target.innerHTML;

        selectedPawns.forEach(pawn => removePawnCondition(pawn, conditionList.find(x => x.name == name)));
        e.target.parentNode.removeChild(e.target);

    }
    btn.innerHTML = condition;
    menuWindow.appendChild(btn);
}

function showConditionsMenu(event) {
    var oldGridLayerOnClick = gridLayer.onclick;
    Util.showOrHide("conditions_menu", 1);
    Util.showOrHide("popup_menu_pawn", -1);
    var menuWindow = document.getElementById("conditions_menu");
    document.getElementById("popup_menu_pawn").classList.add("hidden");
    menuWindow.style.left = event.clientX + "px";
    menuWindow.style.top = event.clientY + "px";
    var buttons = [...menuWindow.getElementsByClassName("condition_button")];
    buttons.forEach(button => button.parentNode.removeChild(button));
    var conditionsAdded = [];
    selectedPawns.forEach(function (pawn) {
        if (!pawn["data-dnd_conditions"]) return;
        pawn["data-dnd_conditions"].forEach(function (condition) {
            if (conditionsAdded.find(x => x == condition)) return;
            createConditionButton(condition);
            conditionsAdded.push(condition);
        });
    });
    menuWindow.querySelector("input").focus();
    window.setTimeout(function () {
        gridLayer.onclick = function (event) {
            hideAllTooltips();
            gridLayer.onclick = oldGridLayerOnClick;
        }

    }, 200)

}


function showPopupMenuGeneral(x, y) {
    document.getElementById("popup_menu_pawn").classList.add("hidden");
    var popup = document.getElementById("popup_menu_general");

    popup.classList.remove("hidden");
    popup.style.left = x + "px";
    popup.style.top = y + "px";
    document.onclick = function (e) {

        document.getElementById("popup_menu_general").classList.add("hidden");
        document.onclick = null;
    }
}
