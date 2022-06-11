# Graph view

![NENO Graph view example](./img/graph%20view%20simple.png)

One of NENO's best features is the Graph View. In the Graph View, your notes are shown as a network graph in which notes are
displayed as graph nodes and links between notes are displayed as graph edges.
You can zoom in and out with the mouse wheel, move notes and add/remove links. Please note, that you have to save
the current state to make your modifications to the graph permanent.

## Accessing the Graph view

Click on the NENO logo in the top left corner to open the application menu.
In there and click on "Graph".

![NENO application menu](./img/menu.png)

## 🟩 The INPI (Initial Node Position Indicator)

New notes will appear at the INPI (Initial Node Position Indicator). It is the green square. You can move the nodes from there to another position. You can also drag and drop the INPI itself to another position.

## Node background colors and what they mean
* ⚪ White (or default node color): Normal nodes
* 🟢 Green: New nodes that have been created within the last few days
* 🔵 Blue: Hubs (nodes with more than 4 links)
* 🔴 Red: Nodes with no links

## Move a node
Just drag a node and drop it where you want it to be.

## Move several nodes at once
To move several nodes at once, first select the nodes which you want to
move. To do this, press and hold the `S` key and click on the nodes you
want to select. If you want to unselect a node, press and hold `S` and click on the selected node again.

After you have finished your selection, drag one of the selected nodes and drop it where
you want it to be. All selected nodes will follow. Please note that the node
you drag is always included in the movement, regardless of whether it is
selected or not.

Press `Esc` to unselect all nodes and edges.

## Create a new edge
To create a new edge, press and hold the `SHIFT` key, then click and hold the
mouse button on one of the nodes of the link to be created and move your cursor
to the other node of the link to be created. Let go of the mouse button. The
new edge is displayed now.

## Remove an edge

Select the edge by pressing and holding `S` and a clicking on the edge. Press `Del` or `Backspace` to remove it.

## Inflate the graph

When you have a graph with a lot of nodes but do not have enough real estate to put more notes in between, you can inflate the graph by 10% by clicking on the button in the title bar.

Don't use this function too often for it will quickly result in a graph which is not well overseeable anymore. Use it only if  absolutely necessary.

## User interface performance

When you have a lot of notes in your graph (> 1000), dragging the graph and zooming in and out may become laggy. If that is the case, you can disable rendering the note titles by clicking  the `Toggle text rendering` button in the title bar. If your graph has at least 500 nodes, text rendering is disabled by default and must be enabled manually by clicking the button.

When text rendering is disabled, note titles are still be displayed in the bottom-left corner when hovering over a node.
