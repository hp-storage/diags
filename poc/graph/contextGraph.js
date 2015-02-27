function contextGraph() {

    //
    // Variables . . .
    //
    var highlightEnabled = true;
    var focusEnabled = true;
    var nodes = [];
    var links = [];
    var graphScale = 1;

    var selectedNode = null;
    var selectedLink = null;

    var focusId = null;

    var nodeSelectCallback = null;
    var linkSelectCallback = null;
    var expandLinkCallback = null;
    var focusSetCallback = null;

    var expandedLinks = [];

    var container = null;

    //
    // Behaviors . . .
    //

    function doZoom () {
        container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    var zoom = d3.behavior.zoom()
                          .scaleExtent([minZoom, maxZoom])
                          .size([svgWidth, svgHeight])
                          .on("zoom", doZoom );

    //
    // Initialize the SVG . . .
    //

    var svg = d3.select("body").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)           
        .attr("class", "graph-svg-component")
        .call(zoom);

    // Create the SVG
    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .style("fill", "none")
        .style("pointer-events", "all");

    container = svg.append("g")
        .attr("name", "container");

    var force = d3.layout.force();

    var dragger = force.drag()
        .on("dragstart", dragstarted);

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
    }

    force.nodes(nodes)                           
        .links(links)                          
        .charge(forceCharge)
        .gravity(forceGravity)
        .linkDistance(function(link) { return setLinkDistance(link); })
        .linkStrength(function(link) { return setLinkStrength(link); })
        .size([svgWidth, svgHeight])
        .on("tick", doTick);                    

    // Define the arrow heads for paths.
    svg.append("defs").append("svg:marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10) 
        .attr("refY", 0)
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("orient", "auto")
        .append("path")
            .attr("d", "M 0,-1.5 L 4,0 L 0,1.5"); 


    //
    // External APIs . . .
    //

    this.toggleHighLight = function () {
        if (highlightEnabled == true) {
            highlightEnabled = false;
	        highlight.attr("visibility", "hidden");
            bracket.attr("visibility", "hidden");
        }
        else {
            highlightEnabled = true;
	        highlight.attr("visibility", "visible");
            bracket.attr("visibility", "visible");
        }
    }

    this.toggleFocus = function () {
        if (focusEnabled == true) {
            focusEnabled = false;
	        focus.attr("visibility", "hidden");
        }
        else {
            focusEnabled = true;
	        focus.attr("visibility", "visible");
        }
    }

    this.zoom2fit = function () {
        var objects = force.nodes();

        var minX = objects[0].x;
        var minY = objects[0].y;
        var maxX = objects[0].x;
        var maxY = objects[0].y;

        objects.forEach( function(item) {
            if (item.x < minX) minX = item.x;
            if (item.y < minY) minY = item.y;
            if (item.x > maxX) maxX = item.x;
            if (item.y > maxY) maxY = item.y;
        } );

        var midX = (maxX + minX) / 2;
        var midY = (maxY + minY) / 2;

        var deltaX = midX - (svgWidth / 2);
        var deltaY = midY - (svgHeight / 2);

        // We'll add 10 to account for the radius of the objects.
        var spanX = maxX - minX + 10;
        var spanY = maxY - minY + 10;

        xRatio = svgWidth / spanX;
        yRatio = svgHeight / spanY;

        var newScale;
        if (xRatio < yRatio) newScale = xRatio;
        else newScale = yRatio;

        var dx = ( (svgWidth / 2) + deltaX) * (newScale - 1) * -1;
        var dy = ( (svgHeight / 2) + deltaY) * (newScale - 1) * -1;

        console.log("ZOOM2FIT : newScale=" + newScale + " dx=" + dx + " dy=" + dy);

        container.transition()
            .duration(500)
            .call(zoom.translate([dx, dy]).scale(newScale).event);
    }

    this.getSelectedNode = function () {
        return selectedNode;
    }

    this.getSelectedLink = function () {
        return selectedLink;
    }

    this.setNodeSelectionCallback = function (callback) {
        nodeSelectCallback = callback;
    }

    this.setFocusSetCallback = function (callback) {
        focusSetCallback = callback;
    }

    this.setLinkSelectionCallback = function (callback) {
        linkSelectCallback = callback;
    }

    this.setExpandLinkCallback = function (callback) {
        expandLinkCallback = callback;
    }

    this.expandThisLink = function (sourceId, targetId) {
        expandedLinks.push( {"start":sourceId, "end":targetId} );
        return expandLinkCallback(expandedLinks); 
    } 

    expandMyLink = function (sourceId, targetId) {
        if (expandLinkCallback != null) {
            expandedLinks.push( {"start":sourceId, "end":targetId} );
            return expandLinkCallback(expandedLinks); 
        }
    } 

    this.setFocus = function (nodeId) {
        nodes.forEach( function(node) {
            if (node.id == nodeId) {
                setFocusNode(node);
                console.log("FOCUS NODE SET!");
                return;
            }
        } );
    }

    this.getFocusNode = function () {
        var nodeList = getFocusNode( force.nodes() );
        if (nodeList.length == 0) {
            return null;
        }
        return nodeList[0];
    }

    this.getNodeLinks = function (node) {
        var links = force.links();

        var incoming = [];
        var outgoing = [];
        var compressed = [];

        for (idx = 0; idx < links.length; idx++)
        {
            var link = links[idx];
            if (link.source.id == node.id) {
                if (link.type == "compressed") {
                    compressed.push(link);
                }
                else {
                    outgoing.push(link);
                }
            }
            else if (link.target.id == node.id) {
                if (link.type == "compressed") {
                    compressed.push(link);
                }
                else {
                    incoming.push(link);
                }
            }
        }

        var result = {};
        result["incoming"] = incoming;
        result["outgoing"] = outgoing;
        result["compressed"] = compressed;

        return result;
    }
 
    //
    // Load the local model with data from the server.
    //
    this.loadGraphData = function (data) {
        var newNodes = data["nodes"];
        var newLinks = data["links"];

        selectNode(null);
        selectLink(null);

        nodes.length = 0;
        links.length = 0;
        expandedLinks.length = 0;

        var focusNode = null;

        // Build an association array for quicker lookups...
        var nodeLookup = {};
        scrubNewNodes(newNodes);
        newNodes.forEach( function(node) {
            nodeLookup[node.id] = node;

            nodes.push(node);
            console.log( "NODE: type=" + node.type + 
                         " name=" + node.name + 
                         " id=" + node.id + 
                         " highlight=" + node.highlight + 
                         " focus=" + node.focus + 
                         " status=" + node.status );

            if (node.focus == "true") {
                focusNode = node;
            }

        } );


        // Connect nodes to edges...
        newLinks.forEach( function(link) {
            link.source = nodeLookup[link.source];
            link.target = nodeLookup[link.target];
            link.status = link.target.status;
 
            links.push(link);
            console.log( "LINK: type=" + link.type +
                         " source=" + link.source.name + " (" + link.source.id + ")" +
                         " target=" + link.target.name + " (" + link.target.id + ")" +
                         " status=" + link.status );
        } );

        // Make a wild guess at an appropriate zoom scale for the diagram.
        var newScale = Math.pow(.95, (nodes.length - 50) ) + 3;
        var dx = (svgWidth / 2)  * (newScale - 1) * -1;
        var dy = (svgHeight / 2) * (newScale - 1) * -1;

        console.log("LOAD : nodes.length=" + nodes.length);
        console.log("LOAD : newScale=" + newScale + " dx=" + dx + " dy=" + dy);

        container.transition()
            .duration(100)
            .call(zoom.translate([dx, dy]).scale(newScale).event);

        if (focusSetCallback != null)
        {
            focusSetCallback(focusNode);
        }

        start();
    }


    //
    //  Change data in the graph.  Add or remove nodes and links, as needed.
    //  
    this.updateGraphData = function (data) {
        var links = force.links();
        var nodes = force.nodes();

        links.length = 0;

        // Add new nodes. 
        scrubNewNodes(data.nodes, "true");

        var nodeLookup = {};
        nodes.forEach( function(node) {
            node.highlight = "false";
            nodeLookup[node.id] = node;
        } );

        data.nodes.forEach ( function(node) { 
            if (nodeLookup[node.id] == undefined) {
                nodes.push(node);
                nodeLookup[node.id] = node;
            }
        } );

        // Add new links
        data.links.forEach( function(newLink) {
            newLink.source = nodeLookup[newLink.source];
            newLink.target = nodeLookup[newLink.target];
            newLink.status = newLink.target.status;

            links.push(newLink);
        } );

        selectNode(selectedNode);
        // selectLink(null);

        // Restart the force layout.
        start();
    }


    //
    // Custom link settings by type.
    //
    function setLinkDistance (link) {
        var distance = linkDistances["link.type"];
        if (distance == undefined) {
            return defaultLinkDistance;
        }
        return distance;
    }

    function setLinkStrength (link) {
        var strength = linkStrengths["link.type"];
        if (strength == undefined) {
            return defaultLinkStrength;
        }
        return strength;
    }


    //
    // Cleanup incoming nodes.
    //
    function scrubNewNodes(nodes, highlight) {
        nodes.forEach( function (node) {
            // Set default name, if required.
            if (node.name == undefined) {
                node.name = node.type;
            };

            // Set default status, if required.
            if (node.status == undefined) {
                node.status = "normal";
            };

            // Set default highlight, if required.
            node.highlight = highlight;

            // Set default focus, if required.
            if (node.focus == undefined) {
                node.focus = "false";
            };
        } ); 
    }

    //
    // Returns an array of all nodes which are represented 
    // by the specified shape in the graph.
    //
    function getNodesOfShape (nodes, shape) {
        var outputArray = [];
        nodes.forEach( function(node) {
            if (nodeShapes[shape].indexOf(node.type) != -1 ) {
                outputArray.push(node);
            };
        } );
        return outputArray;
    }

    //
    // Return a list of nodes in the specified state.
    //
    function getNodesByStatus (nodes, status) {
        var outputArray = [];
        nodes.forEach( function(node) {
            if (node.status == status) {
                outputArray.push(node);
            };
        } );
        return outputArray;
    }

    //
    // Return a list of highlighted nodes.
    //
    function getHighlightedNodes (nodes) {
        var outputArray = [];
        nodes.forEach( function(node) {
            if (node.highlight == "true") {
                outputArray.push(node);
            };
        } );
        return outputArray;
    }

    //
    // Return the focus node, if any.
    //
    function getFocusNode (nodes) {
        var outputArray = [];
        nodes.forEach( function(node) {
            if (node.focus == "true") {
                console.log( "*****  FOCUS NODE : type=" + node.type + 
                         " name=" + node.name + 
                         " id=" + node.id + 
                         " highlight=" + node.highlight + 
                         " focus=" + node.focus + 
                         " status=" + node.status );
                outputArray.push(node);
            };
        } );
        return outputArray;
    }


    // Shortcut selections for graph entities.
    var circle = container.selectAll(".circle");    
    var oval = container.selectAll(".ellipse");    
    var square = container.selectAll(".rect");   
    var tall = container.selectAll(".rect");   
    var wide = container.selectAll(".rect");   
    var triangle = container.selectAll(".polygon");   
    var pentagon = container.selectAll(".polygon");   
    var hexagon = container.selectAll(".polygon");   
    var rhombus = container.selectAll(".polygon");   
    var trapezoid = container.selectAll(".polygon");   
    var parallel = container.selectAll(".polygon");   

    var text = container.selectAll(".text");   
    var warn = container.selectAll(".warn");   
    var warnLabel = container.selectAll(".warnLabel");   
    var crit = container.selectAll(".crit");   
    var link = container.selectAll(".link");   
    var linkClickArea = container.selectAll(".link-click-area");   
    var highlight = container.selectAll(".highlight");   
    var bracket = container.selectAll(".bracket");   
    var focus = container.selectAll(".focus");
    var allNodes = container.selectAll(".node");


    //
    // Start or re-start the force layout.
    //
    function start () {
        // Highlight backgrounds
        highlight.remove();
        highlight = container.selectAll(".highlight");
        highlight = highlight.data( getHighlightedNodes(force.nodes() ) )
            .enter().append("rect")
            .attr("height", 5.2)
            .attr("width", 5.2)
            .attr("x", -2.6)
            .attr("y", -2.6)
            .attr("class", "highlight");

        // Highlight brackets
        bracket.remove();
        bracket = container.selectAll(".bracket");
        bracket = bracket.data( getHighlightedNodes(force.nodes() ) )
            .enter().append("path")
            .attr("d", "M -2.6,-1.5 L -2.6,-2.6 L -1.5,-2.6 \
                        M 1.5,-2.6 L 2.6,-2.6 L 2.6,-1.5 \
                        M 2.6,1.5 L 2.6,2.6 L 1.5,2.6 \
                        M -1.5,2.6 L -2.6,2.6 L -2.6,1.5")
            .attr("class", "bracket");

        // Links
        link.remove();
        link = container.selectAll(".link");
        link = link.data(force.links(), function(d) { return d.source.id + "-" + d.target.id; });
        var linkbox = link.enter().append("g").attr("class", "linkbox");
        link.append("line")
            .attr("class", function(d) { return "link " + d.type; } )
            .attr("marker-end", "url(#arrowhead)")
            .on("mouseover", function(d) { return linkToolTipIn(d); } ) 
            .on("mouseout", function(d) { return toolTipOut(d); } )
            .on("click", function(d) { return selectLink(d); } )
            .on("dblclick", function(d) { 
                    if (d.type == "compressed") {
                            d3.event.stopPropagation(); 
                            return expandMyLink(d.source.id, d.target.id); } 
                    } );
        link.append("text")
            .attr("class", "linktext")
            .attr("text-anchor", "middle")
            .attr("x", function(d) { return d.source.x; } )
            .attr("y", function(d) { return d.source.y; } )
            .text( function(d) { return d.type; } );
        link.exit().remove();

        // Circles
        circle.remove();
        circle = container.selectAll(".circle");
        circle = circle.data(getNodesOfShape(force.nodes(), "circle"), function(d) { return d.id; });
        circle.enter().append("g").attr("class", "nodebox")
            .append("circle")
            .attr("class", function(d) { return "node " + d.type; })
            .attr("r", 2.0);
        circle.exit().remove();

        // Ovals
        oval.remove();
        oval = container.selectAll(".ellipse");
        oval = oval.data(getNodesOfShape(force.nodes(), "oval"), function(d) { return d.id; });
        oval.enter().append("g").attr("class", "nodebox")
            .append("ellipse")
            .attr("class", function(d) { return "node " + d.type; })
            .attr("rx", 2.0)
            .attr("ry", 1.2);
        oval.exit().remove();

        // Squares
        square.remove();
        square = container.selectAll(".square");
        square = square.data(getNodesOfShape(force.nodes(), "square"), function(d) { return d.id; } );
        square.enter().append("g").attr("class", "nodebox")
            .append("rect")
            .attr("class", function(d) { return "node " + d.type; } )
            .attr("height", 3.2)
            .attr("width", 3.2)
            .attr("x", -1.6)
            .attr("y", -1.6);
        square.exit().remove();

        // Tall Rectangles
        tall.remove();
        tall = container.selectAll(".rect");
        tall = tall.data( getNodesOfShape(force.nodes(), "tall"), function(d) { return d.id; } );
        tall.enter().append("g").attr("class", "nodebox")
            .append("rect")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("height", 4.4)
            .attr("width", 3.0)
            .attr("x", -1.5)
            .attr("y", -2.2);
        tall.exit().remove();

        // Wide Rectangles
        wide.remove();
        wide = container.selectAll(".rect");
        wide = wide.data( getNodesOfShape(force.nodes(), "wide"), function(d) { return d.id; } );
        wide.enter().append("g").attr("class", "nodebox")
            .append("rect")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("height", 3.0)
            .attr("width", 4.4)
            .attr("x", -2.2)
            .attr("y", -1.5);
        wide.exit().remove();

        // Triangles
        triangle.remove();
        triangle = container.selectAll(".polygon");
        triangle = triangle.data( getNodesOfShape(force.nodes(), "triangle"), function(d) { return d.id; } );
        triangle.enter().append("g").attr("class", "nodebox")
            .append("polygon")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("points", "0,-2.0 -1.8,1.0 1.8,1.0");
        triangle.exit().remove();

        // Pentagons
        pentagon.remove();
        pentagon = container.selectAll(".polygon");
        pentagon = pentagon.data( getNodesOfShape(force.nodes(), "pentagon"), function(d) { return d.id; } )
        pentagon.enter().append("g").attr("class", "nodebox")
            .append("polygon")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("points", "0,-2.0 -2.0,-.6 -1.2,1.6 1.2,1.6 2.0,-.6");
        pentagon.exit().remove();

        // Hexagons
        hexagon.remove();
        hexagon = container.selectAll(".polygon");
        hexagon = hexagon.data( getNodesOfShape(force.nodes(), "hexagon"), function(d) { return d.id; } )
        hexagon.enter().append("g").attr("class", "nodebox")
            .append("polygon")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("points", "1.2,-2.0 -1.2,-2.0 -2.4,0 -1.2,2.0 1.2,2.0 2.4,0");
        hexagon.exit().remove();

        // Rhombi
        rhombus.remove();
        rhombus = container.selectAll(".polygon");
        rhombus = rhombus.data( getNodesOfShape(force.nodes(), "rhombus"), function(d) { return d.id; } )
        rhombus.enter().append("g").attr("class", "nodebox")
            .append("polygon")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("points", "0,-2.0 2.0,0 0,2.0 -2.0,0");
        rhombus.exit().remove();

        // Trapezoids
        trapezoid.remove();
        trapezoid = container.selectAll(".polygon");
        trapezoid = trapezoid.data( getNodesOfShape(force.nodes(), "trapezoid"), function(d) { return d.id; } )
        trapezoid.enter().append("g").attr("class", "nodebox")
            .append("polygon")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("points", "-1.0,-2.0 1.0,-2.0 2.0,2.0 -2.0,2.0");
        trapezoid.exit().remove();

        // Parallelograms
        parallel.remove();
        parallel= container.selectAll(".polygon");
        parallel= parallel.data( getNodesOfShape(force.nodes(), "parallel"), function(d) { return d.id; } )
        parallel.enter().append("g").attr("class", "nodebox")
            .append("polygon")
            .attr("class", function(d) { return ( "node " + d.type ); } )
            .attr("points", "-1.0,-2.0 2.0,-2.0 1.0,2.0 -2.0,2.0");
        parallel.exit().remove();

        // Warning icons
        warn.remove();
        warn = container.selectAll(".warn");
        warn = warn.data( getNodesByStatus(force.nodes(), "warning") )
            .enter().append("polygon")
            .attr("class", "warning")
            .attr("points", "-2.0,1.0 -2.9,2.5 -1.1,2.5");
    
        // Putting an "!" on the Warning icons
        warnLabel.remove();
        warnLabel = container.selectAll(".warnLabel");
        warnLabel = warnLabel.data( getNodesByStatus(force.nodes(), "warning") )
            .enter().append("text")
            .attr("class", "warnLabel")
            .attr("x", -2.4)
            .attr("y", 2.3)
            .text("!");

        // Crit icons
        crit.remove();
        crit = container.selectAll(".crit");
        crit = crit.data( getNodesByStatus(force.nodes(), "critical") )
            .enter().append("polygon")
            .attr("class", "critical")
            .attr("points", "   -2.3,.7 -2.1,.7 -1.5,1.3  -.9,.7 -.7,.7 -.7,.9 -1.3,1.5 -.7,2.1 -.7,2.3 -.9,2.3 -1.5,1.7 -2.1,2.3 -2.3,2.3 -2.3,2.1 -1.7,1.5 -2.3,.9");

        // Focus indicator
        focus.remove();
        focus = container.selectAll(".focus");
        var focused = getFocusNode( force.nodes() );
        if (focused.length != 0) {
            focus = focus.data(focused).enter()
                .append("path")
                .attr("d", "M  2.5,0.0 L  4.0,-0.5 L  4.0,0.5 Z \
                            M -2.5,0.0 L -4.0,-0.5 L -4.0,0.5 Z \
                            M  0.0, 2.5 L 0.5,4.0  L -0.5,4.0 Z  \
                            M  0.0,-2.5 L 0.5,-4.0 L -0.5,-4.0 Z")
                .attr("class", "focus");
        }

        //
        // Attributes common to all nodes ...
        //
        var allNodes = container.selectAll(".node").data( force.nodes(), function(d) { return d.id; } );
        allNodes.on("mouseover", function(d) { return nodeToolTipIn(d); } ) 
                .on("mouseout", function(d) { return toolTipOut(d); } )
                .on("click", function(d) { return selectNode(d); } )
                .on("dblclick", function(d) { d3.event.stopPropagation(); return setFocusNode(d); } )
                .call( dragger );

        var allNodeBoxes = container.selectAll(".nodebox").data( force.nodes(), function(d) { return d.id; } );
        allNodeBoxes.append("text")
            .attr("text-anchor", "middle")
            .attr("fill", "#000000")
            .attr("y", ".31em")
            .text(function(d) {return d.name;});

        force.start();
    }


    //
    // Run a cycle of the force layout's positioning algorithm.
    //
    function doTick () {
        circle.attr("transform", transform);
        oval.attr("transform", transform);
        square.attr("transform", transform);
        tall.attr("transform", transform);
        wide.attr("transform", transform);
        triangle.attr("transform", transform);  
        pentagon.attr("transform", transform);  
        hexagon.attr("transform", transform);  
        rhombus.attr("transform", transform);  
        trapezoid.attr("transform", transform);  
        parallel.attr("transform", transform);  

        warn.attr("transform", transform);  
        warnLabel.attr("transform", transform);  
        crit.attr("transform", transform);  

        highlight.attr("transform", transform);  
        bracket.attr("transform", transform);  
        focus.attr("transform", transform);  

        link.select(".link")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        link.select(".linktext")
            .attr("x", function(d) { return getLinkTextX(d.source, d.target); } )
            .attr("y", function(d) { return getLinkTextY(d.source, d.target); } )
            .attr("transform", function(d) { return getLinkTextR(d.source, d.target); } )
    }

    
    //
    // Layout tick mechanism
    //
    var transform = function (d) {
        return "translate(" + d.x + "," + d.y + ")";
    }


    //
    // Position and rotate link text.
    //
    function getLinkTextX (source, target) {
        var cx = (source.x + target.x) / 2;
        return cx;
    }

    function getLinkTextY (source, target) {
        var cy = (source.y + target.y) / 2;
        return cy;
    }

    function getLinkTextR (source, target) {
        var cx = (source.x + target.x) / 2;
        var cy = (source.y + target.y) / 2;
        var dx = source.x - target.x;
        var dy = source.y - target.y;
        var angleRads = 0;
        var angleDegs = 0;
        if (dx == 0) {
            if (dy > 0) angleDegs = 90;
            else angleDegs = 270;
        }
        else
        {
            var tanAngle = dy / dx;
            angleRads = Math.atan(tanAngle);
            angleDegs = angleRads * (180 / Math.PI);
        }

        return "rotate("+angleDegs+" "+cx+","+cy+")";
    }


    //
    // Tooltips . . .
    //
    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    function nodeToolTipIn (d) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
            tooltip.html("<b>Name:</b> " + d.name + 
                    "<br> <b>Type:</b> " + d.type + 
                    "<br> <b>Status:</b> " + d.status)
            .style("left", (d3.event.pageX + 10) + "px")
            .style("top", (d3.event.pageY + 10) + "px");
    }

    function linkToolTipIn (d) {
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
            tooltip.html("<b>Source:</b> " + d.source.name + 
                    "<br> <b>Target:</b> " + d.target.name + 
                    "<br> <b>Type:</b> " + d.type)
            .style("left", (d3.event.pageX + 10) + "px")
            .style("top", (d3.event.pageY + 10) + "px");
    }

    function toolTipOut (d) {
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    }


    //
    // Selection mechanisms . . .
    //

    function selectNode (d) {
        selectedNode = d;
        if (nodeSelectCallback != null)
        {
            nodeSelectCallback(d);
        }
    }

    function selectLink (d) {
        selectedLink = d;
        if (linkSelectCallback != null)
        {
            linkSelectCallback(d);
        }
    }

    function setFocusNode (d) {
        focusEnabled = true;

        focus.remove();
        focusId = null;

        if (d != null) {
            focusId = d.id;

            var focused = getFocusNode( force.nodes() );
            if (focused.length != 0) {
                focused[0].focus = "false";
            }
            d.focus = "true";
            focus = container.selectAll(".focus");
            focus = focus.data([d]).enter()
                .append("path")
                .attr("d", "M  2.5,0.0 L  4.0,-0.5 L  4.0,0.5 Z \
                            M -2.5,0.0 L -4.0,-0.5 L -4.0,0.5 Z \
                            M  0.0, 2.5 L 0.5,4.0  L -0.5,4.0 Z \
                            M  0.0,-2.5 L 0.5,-4.0 L -0.5,-4.0 Z")
                .attr("class", "focus")
                .attr("transform", transform);  
        }

        if (focusSetCallback != null)
        {
            focusSetCallback(d);
        }
    }

}
