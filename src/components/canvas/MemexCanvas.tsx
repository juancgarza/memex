"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { TextNode } from "./nodes/TextNode";
import { ChatReferenceNode } from "./nodes/ChatReferenceNode";
import { NoteNode } from "./nodes/NoteNode";
import { useTheme } from "@/lib/theme";

const nodeTypes: NodeTypes = {
  text: TextNode,
  chat_reference: ChatReferenceNode,
  note: NoteNode,
};

export function MemexCanvas() {
  const { theme } = useTheme();
  const canvasNodes = useQuery(api.canvas.listNodes);
  const canvasEdges = useQuery(api.canvas.listEdges);
  const createNode = useMutation(api.canvas.createNode);
  const updateNode = useMutation(api.canvas.updateNode);
  const deleteNode = useMutation(api.canvas.deleteNode);
  const createEdge = useMutation(api.canvas.createEdge);
  const deleteEdge = useMutation(api.canvas.deleteEdge);
  const embedCanvasNode = useAction(api.embeddings.embedCanvasNode);
  const findRelated = useAction(api.embeddings.findRelated);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Theme-aware colors
  const edgeColor = theme === "dark" ? "#6366f1" : "#8f3f71";
  const edgeLabelColor = theme === "dark" ? "#a5b4fc" : "#8f3f71";
  const edgeLabelBgColor = theme === "dark" ? "#1e1b4b" : "rgba(242, 229, 188, 0.9)";
  const gridColor = theme === "dark" ? "#27272a" : "#d5c4a1";
  const minimapNodeColor = theme === "dark" ? "#3b82f6" : "#076678";
  const minimapMaskColor = theme === "dark" ? "rgba(0, 0, 0, 0.8)" : "rgba(251, 241, 199, 0.8)";

  // Find related nodes and create edges
  const handleFindRelated = useCallback(
    async (nodeId: Id<"canvasNodes">, content: string) => {
      try {
        const related = await findRelated({ query: content, limit: 3 });

        for (const node of related.nodes) {
          if (node && node._id !== nodeId) {
            await createEdge({
              source: nodeId,
              target: node._id as Id<"canvasNodes">,
              label: `${Math.round(node.score * 100)}%`,
            });
          }
        }
      } catch (err) {
        console.error("Failed to find related:", err);
      }
    },
    [findRelated, createEdge],
  );

  // Handle content change and re-embed
  const handleContentChange = useCallback(
    async (nodeId: Id<"canvasNodes">, content: string) => {
      await updateNode({ id: nodeId, content });
      // Re-embed with new content
      embedCanvasNode({ nodeId, content }).catch(console.error);
    },
    [updateNode, embedCanvasNode],
  );

  // Sync from Convex to React Flow
  useEffect(() => {
    if (canvasNodes) {
      const flowNodes: Node[] = canvasNodes.map((node: {
        _id: Id<"canvasNodes">;
        type: string;
        x: number;
        y: number;
        content: string;
        messageId?: Id<"messages">;
        conversationId?: Id<"conversations">;
        width?: number;
        height?: number;
      }) => ({
        id: node._id,
        type: node.type,
        position: { x: node.x, y: node.y },
        data: {
          content: node.content,
          messageId: node.messageId,
          conversationId: node.conversationId,
          onContentChange: (content: string) => {
            handleContentChange(node._id, content);
          },
          onDelete: () => {
            deleteNode({ id: node._id });
          },
          onFindRelated: () => {
            handleFindRelated(node._id, node.content);
          },
        },
        style: { width: node.width, height: node.height },
      }));
      setNodes(flowNodes);
    }
  }, [
    canvasNodes,
    setNodes,
    handleContentChange,
    deleteNode,
    handleFindRelated,
  ]);

  useEffect(() => {
    if (canvasEdges) {
      const flowEdges: Edge[] = canvasEdges.map((edge: {
        _id: Id<"canvasEdges">;
        source: Id<"canvasNodes">;
        target: Id<"canvasNodes">;
        label?: string;
      }) => ({
        id: edge._id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: true,
        style: { stroke: edgeColor },
        labelStyle: { fill: edgeLabelColor, fontSize: 10 },
        labelBgStyle: { fill: edgeLabelBgColor, fillOpacity: 0.9 },
      }));
      setEdges(flowEdges);
    }
  }, [canvasEdges, setEdges, edgeColor, edgeLabelColor, edgeLabelBgColor]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Persist position changes to Convex
      changes.forEach((change) => {
        if (
          change.type === "position" &&
          change.position &&
          change.dragging === false
        ) {
          updateNode({
            id: change.id as Id<"canvasNodes">,
            x: change.position.x,
            y: change.position.y,
          });
        }
      });
    },
    [onNodesChange, updateNode],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);

      changes.forEach((change) => {
        if (change.type === "remove") {
          deleteEdge({ id: change.id as Id<"canvasEdges"> });
        }
      });
    },
    [onEdgesChange, deleteEdge],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        createEdge({
          source: connection.source as Id<"canvasNodes">,
          target: connection.target as Id<"canvasNodes">,
        });
      }
      setEdges((eds) => addEdge(connection, eds));
    },
    [createEdge, setEdges],
  );

  const onDoubleClick = useCallback(
    async (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      // Only create node if clicking on the pane, not on existing nodes
      if (!target.closest(".react-flow__node")) {
        const bounds = target.closest(".react-flow")?.getBoundingClientRect();
        if (!bounds) return;

        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;

        const nodeId = await createNode({
          type: "note",
          content: "New note...",
          x,
          y,
        });

        // Embed the new node
        embedCanvasNode({ nodeId, content: "New note..." }).catch(
          console.error,
        );
      }
    },
    [createNode, embedCanvasNode],
  );

  return (
    <div className="w-full h-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDoubleClick={onDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
      >
        <Background color={gridColor} gap={20} />
        <Controls />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor={minimapMaskColor}
        />
      </ReactFlow>
    </div>
  );
}
