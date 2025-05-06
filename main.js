/*
 * Copyright (C) 2025 Marcus Low
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see https://www.gnu.org/licenses/.
 */

// event colours are stored in local storage
// format: task_color_<task id> -> <color>

// globals to keep track of colour being set
let previousColour = null;
let creatingNode = null;
let pendingCreation = false;

function onDOMChange(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.getAttribute("aria-labelledby") === "tabTask") { // task creation dialog
            // add colour selector to new task screen
            let input = document.createElement("input");
            input.type = "color";
            input.oninput = event => {
                previousColour = event.target.value;
                pendingCreation = true;
                // update event colour in realtime
                if (creatingNode != null) colourEvent(previousColour, creatingNode);
            }
            node.appendChild(input)
        } else if (node.hasAttribute("data-taskid")) { // select task view dialog
            if (node.parentElement != null
                && node.parentElement.parentElement != null
                && node.parentElement.parentElement.getAttribute("role") === "dialog") {

                let taskId = node.getAttribute("data-taskid")
                if (localStorage.getItem("task_color_" + taskId) != null) {
                    // colour the dot in the task view dialog (one click)
                    node.childNodes.item(1).firstChild.firstChild.firstChild.firstChild.style.backgroundColor = localStorage.getItem("task_color_" + taskId)
                }

                // create edit colour button
                let node1 = document.createElement("input");
                node1.type = "color";
                if (localStorage.getItem("task_color_" + taskId) != null) node1.value = localStorage.getItem("task_color_" + taskId);

                node1.oninput = event => {
                    localStorage.setItem("task_color_" + taskId, event.target.value);
                    colourEvent(event.target.value, document.querySelector("[data-eventid=tasks_" + taskId + "]"));
                }
                node.lastChild.appendChild(node1);
                creatingNode = null;
                pendingCreation = false;
            }
        } else if (node.hasAttribute("data-eventid")) { // select event on calendar
            // color task in on calendar
            tryColourEventButton(node, false)
        }
    }

    // recursively check all children too
    node.childNodes.forEach(n => onDOMChange(n));
}

function colourEvent(colour, target) {
    if (colour != null) {
        if (target.firstChild?.firstChild?.firstChild?.nodeName === "DIV") {
            target.firstChild.firstChild.firstChild.style.borderColor = colour;
        } else {
            target.style.borderColor = colour;
            if (target.firstChild == null) target.style.backgroundColor = colour; // timed task dot
            if (target.firstChild != null) target.firstChild.style.backgroundColor = colour; // day task background
        }
    }
}

function tryColourEventButton(target, set) {
    let eventId = target.getAttribute("data-eventid");
    if (eventId.length === 52) { // events being created have a longer id
        creatingNode = target
    } else if (eventId.startsWith("tasks_") // check if the event is a task
        && eventId !== "tasks_rollover_view" // check that the button is not a rollover group (past due date)
        && target.hasAttribute("data-eventchip")) {
        eventId = eventId.substring("tasks_".length); // task id starts after tasks_ prefix
        if (pendingCreation && previousColour != null && set) {
            localStorage.setItem("task_color_" + eventId, previousColour);
            pendingCreation = false;
            previousColour = null;
            creatingNode = null;
        }
        if (localStorage.getItem("task_color_" + eventId) != null) {
            let colour = localStorage.getItem("task_color_" + eventId)
            colourEvent(colour, target);
        }
    }
}

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        if (mutation.type === "childList") {
            mutation.addedNodes.forEach(node => onDOMChange(node))
        } else if (mutation.type === "attributes") {
            if (mutation.attributeName === "data-eventid") {
                tryColourEventButton(mutation.target, true);
            } else if (mutation.attributeName === "data-start-date-key" || mutation.attributeName === "data-end-date-key") {
                pendingCreation = false;
                previousColour = null;
                creatingNode = null;
            }
        }
    }
});

observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-eventid", "data-start-date-key", "data-end-date-key"],
    childList: true,
    subtree: true
});
