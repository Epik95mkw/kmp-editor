const { GfxScene, GfxCamera, GfxMaterial, GfxModel, GfxNodeRenderer, GfxNodeRendererTransform } = require("../gl/scene.js")
const { ModelBuilder } = require("../util/modelBuilder.js")
const { Vec3 } = require("../math/vec3.js")
const { Mat4 } = require("../math/mat4.js")
const { Geometry } = require("../math/geometry.js")


class ViewerCannonPoints
{
	constructor(window, viewer, data)
	{
		this.window = window
		this.viewer = viewer
		this.data = data
		
		this.scene = new GfxScene()
		this.sceneAfter = new GfxScene()
		
		this.hoveringOverPoint = null
		this.linkingPoints = false

		this.cannonTriggers = new Array(8).fill([])

		this.modelPoint = new ModelBuilder()
			.addSphere(-150, -150, -150, 150, 150, 150)
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelPointSelection = new ModelBuilder()
			.addSphere(-250, -250, 250, 250, 250, -250)
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.modelPath = new ModelBuilder()
			.addCylinder(-150, -150, 0, 150, 150, 1000, 8, new Vec3(1, 0, 0))
			.calculateNormals()
			.makeModel(viewer.gl)
		
		this.modelArrow = new ModelBuilder()
			.addCone(-250, -250, 1000, 250, 250, 1300, 8, new Vec3(1, 0, 0))
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.modelArrowUp = new ModelBuilder()
			.addCone(-150, -150, 600, 150, 150, 1500, 8, new Vec3(0, 0.01, 1).normalize())
			.calculateNormals()
			.makeModel(viewer.gl)
			
		let panelColor = [1, 0.5, 0.5, 1]
		this.modelPanel = new ModelBuilder()
			.addQuad(new Vec3(0, 0, 1), new Vec3(1, 0, 1), new Vec3(1, 0, -1), new Vec3(0, 0, -1), panelColor, panelColor, panelColor, panelColor)
			.addQuad(new Vec3(0, 0, -1), new Vec3(1, 0, -1), new Vec3(1, 0, 1), new Vec3(0, 0, 1), panelColor, panelColor, panelColor, panelColor)
			.calculateNormals()
			.makeModel(viewer.gl)
			
		this.renderers = []
	}
	
	
	setData(data)
	{
		this.data = data
		this.refresh()
	}
	
	
	destroy()
	{
		for (let r of this.renderers)
			r.detach()
		
		this.renderers = []
	}
	
	
	refreshPanels()
	{
		let panel = this.window.addPanel("Cannon Points", false, (open) => { if (open) this.viewer.setSubviewer(this) })
		this.panel = panel
	
		panel.addCheckbox(null, "Draw rotation guides", this.viewer.cfg.enableRotationRender, (x) => this.viewer.cfg.enableRotationRender = x)
		panel.addCheckbox(null, "Draw backwards Y rotation guides", this.viewer.cfg.cannonsEnableDirectionRender, (x) => this.viewer.cfg.cannonsEnableDirectionRender = x)
		panel.addText(null, "<strong>Hold Alt + Click:</strong> Create Point")
		panel.addText(null, "<strong>Hold Alt + Drag Point:</strong> Duplicate Point")
		panel.addText(null, "<strong>Hold Ctrl:</strong> Multiselect")
		panel.addButton(null, "(A) Select/Unselect All", () => this.toggleAllSelection())
		panel.addButton(null, "(X) Delete Selected", () => this.deleteSelectedPoints())
		panel.addButton(null, "(Y) Snap To Collision Y", () => this.snapSelectedToY())
		
		let selectedPoints = this.data.cannonPoints.nodes.filter(p => p.selected)
		
		let selectionGroup = panel.addGroup(null, "Selection:")
		let enabled = (selectedPoints.length > 0)
		let multiedit = (selectedPoints.length > 1)
		
		if (selectedPoints.length == 1)
		{
			let selectedIndex = this.data.cannonPoints.nodes.findIndex(p => p === selectedPoints[0])
			panel.addText(selectionGroup, "<strong>CNPT Index:</strong> " + selectedIndex + " (0x" + selectedIndex.toString(16) + ")")
		}
		
		panel.addSelectionNumericInput(selectionGroup, "Dest. X", -1000000, 1000000, selectedPoints.map(p =>  p.pos.x),       null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.x = x })
		panel.addSelectionNumericInput(selectionGroup, "Dest. Y", -1000000, 1000000, selectedPoints.map(p => -p.pos.z),       null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.z = -x })
		panel.addSelectionNumericInput(selectionGroup, "Dest. Z", -1000000, 1000000, selectedPoints.map(p => -p.pos.y),       null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.y = -x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. X", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.x),  null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.x = x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. Y", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.y),  null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.y = x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. Z", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.z),  null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.z = x })
		// panel.addSelectionNumericInput(selectionGroup, "Unknown",        0,  0xffff, selectedPoints.map(p =>  p.id),           1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].id = x })
		
		let effectOptions =
		[
			{ str: "Fast, Straight Line", value: 0xffff },
			{ str: "Curved", value: 1 },
			{ str: "Curved (and Slow?)", value: 2 },
			{ str: "Slow", value: 3 },
		]
		panel.addSelectionDropdown(selectionGroup, "Effect", selectedPoints.map(p => p.effect), effectOptions, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].effect = x })
	}
	
	
	refresh()
	{
		for (let r of this.renderers)
			r.detach()
		
		this.renderers = []
		
		for (let point of this.data.cannonPoints.nodes)
		{
			if (point.selected === undefined)
			{
				point.selected = false
				point.moveOrigin = point.pos
			}
			
			point.renderer = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
			
			point.rendererSelected = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelPointSelection)
				.setMaterial(this.viewer.materialUnshaded)
				.setEnabled(false)
				
			point.rendererSelectedCore = new GfxNodeRenderer()
				.attach(point.rendererSelected)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
				
			point.rendererDirection = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPath)
				.setMaterial(this.viewer.material)
				
			point.rendererDirectionArrow = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelArrow)
				.setMaterial(this.viewer.material)
				
			point.rendererDirectionUp = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelArrowUp)
				.setMaterial(this.viewer.material)
				
			point.rendererPanel = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPanel)
				.setMaterial(this.viewer.material)
				
			this.renderers.push(point.renderer)
			this.renderers.push(point.rendererSelected)
			this.renderers.push(point.rendererDirection)
			this.renderers.push(point.rendererDirectionArrow)
			this.renderers.push(point.rendererDirectionUp)
			this.renderers.push(point.rendererPanel)
		}

		//require('fs').appendFile('out.txt', 'refresh\n')
		
		this.refreshPanels()
	}
	
	
	getHoveringOverElement(cameraPos, ray, distToHit, includeSelected = true)
	{
		let elem = null
		
		let minDistToCamera = distToHit + 1000
		let minDistToPoint = 1000000
		for (let point of this.data.cannonPoints.nodes)
		{
			if (!includeSelected && point.selected)
				continue
			
			let distToCamera = point.pos.sub(cameraPos).magn()
			if (distToCamera >= minDistToCamera)
				continue
			
			let scale = this.viewer.getElementScale(point.pos)
			
			let pointDistToRay = Geometry.linePointDistance(ray.origin, ray.direction, point.pos)
			
			if (pointDistToRay < 150 * scale * 4 && pointDistToRay < minDistToPoint)
			{
				elem = point
				minDistToCamera = distToCamera
				minDistToPoint = pointDistToRay
			}
		}
		
		return elem
	}
	
	
	selectAll()
	{
		for (let point of this.data.cannonPoints.nodes)
			point.selected = true
		
		this.refreshPanels()
	}
	
	
	unselectAll()
	{
		for (let point of this.data.cannonPoints.nodes)
			point.selected = false
		
		this.refreshPanels()
	}
	
	
	toggleAllSelection()
	{
		let hasSelection = (this.data.cannonPoints.nodes.find(p => p.selected) != null)
		
		if (hasSelection)
			this.unselectAll()
		else
			this.selectAll()
	}
	
	
	deleteSelectedPoints()
	{
		let pointsToDelete = []
		
		for (let point of this.data.cannonPoints.nodes)
		{
			if (!point.selected)
				continue
			
			pointsToDelete.push(point)
		}
		
		for (let point of pointsToDelete)
			this.data.cannonPoints.removeNode(point)
		
		this.refresh()
		this.window.setNotSaved()
		this.window.setUndoPoint()
	}


	snapSelectedToY()
	{
		for (let point of this.data.cannonPoints.nodes)
		{
			if (point.selected)
			{
				let hit = this.viewer.collision.raycast(point.pos, new Vec3(0, 0, 1))
				if (hit != null)
					point.pos = hit.position
			}
		}
		
		this.refresh()
		this.window.setNotSaved()
		this.window.setUndoPoint()
	}
	
	
	onKeyDown(ev)
	{
		switch (ev.key)
		{
			case "A":
			case "a":
				this.toggleAllSelection()
				return true
			
			case "Backspace":
			case "Delete":
			case "X":
			case "x":
				this.deleteSelectedPoints()
				return true

			case "Y":
			case "y":
				this.snapSelectedToY()
				return true
		}
		
		return false
	}
	
	
	onMouseDown(ev, x, y, cameraPos, ray, hit, distToHit, mouse3DPos)
	{
		this.linkingPoints = false
		
		for (let point of this.data.cannonPoints.nodes)
			point.moveOrigin = point.pos
		
		let hoveringOverElem = this.getHoveringOverElement(cameraPos, ray, distToHit)
		
		if (ev.altKey || (!ev.ctrlKey && (hoveringOverElem == null || !hoveringOverElem.selected)))
			this.unselectAll()
		
		if (hoveringOverElem != null)
		{
			if (ev.altKey)
			{
				let newPoint = this.data.cannonPoints.addNode()
				newPoint.pos = hoveringOverElem.pos.clone()
				newPoint.rotation = hoveringOverElem.rotation.clone()
				newPoint.id = hoveringOverElem.id
				newPoint.effect = hoveringOverElem.effect
				
				this.refresh()
				
				newPoint.selected = true
				this.viewer.setCursor("-webkit-grabbing")
				this.refreshPanels()
				this.window.setNotSaved()
			}
			else
			{
				hoveringOverElem.selected = true
				require('fs').appendFile('out.txt', this.cannonTriggers.toString() + '\n')
				let index = this.data.cannonPoints.nodes.findIndex(p => p === hoveringOverElem)
				require('fs').appendFile('out.txt', 'test2\n')
				for (let tri of this.cannonTriggers[index])
				{
					require('fs').appendFile('out.txt', tri.flags + '\n')
					tri.color = [1, 1, 0, 1]
					tri.forced = true
				}
				require('fs').appendFile('out.txt', 'test3\n')
				this.window.refreshKcl()
				require('fs').appendFile('out.txt', 'test4\n')
				this.refreshPanels()
				this.viewer.setCursor("-webkit-grabbing")
			}
		}
		else if (ev.altKey)
		{
			let newPoint = this.data.cannonPoints.addNode()
			newPoint.pos = mouse3DPos
			
			this.refresh()
			newPoint.selected = true
			this.viewer.setCursor("-webkit-grabbing")
			this.refreshPanels()
			this.window.setNotSaved()
		}
	}
	
	
	onMouseMove(ev, x, y, cameraPos, ray, hit, distToHit)
	{
		if (!this.viewer.mouseDown)
		{
			let lastHover = this.hoveringOverPoint
			this.hoveringOverPoint = this.getHoveringOverElement(cameraPos, ray, distToHit)
			
			if (this.hoveringOverPoint != null)
				this.viewer.setCursor("-webkit-grab")
			
			if (this.hoveringOverPoint != lastHover)
				this.viewer.render()
		}
		else
		{
			if (this.viewer.mouseAction == "move")
			{
				let linkToPoint = this.getHoveringOverElement(cameraPos, ray, distToHit, false)
				
				for (let point of this.data.cannonPoints.nodes)
				{
					if (!point.selected)
						continue
					
					this.window.setNotSaved()
					this.viewer.setCursor("-webkit-grabbing")
					
					if (this.linkingPoints && linkToPoint != null)
					{
						point.pos = linkToPoint.pos
					}
					else
					{					
						let screenPosMoved = this.viewer.pointToScreen(point.moveOrigin)
						screenPosMoved.x += this.viewer.mouseMoveOffsetPixels.x
						screenPosMoved.y += this.viewer.mouseMoveOffsetPixels.y
						let pointRayMoved = this.viewer.getScreenRay(screenPosMoved.x, screenPosMoved.y)
						
						let hit = this.viewer.collision.raycast(pointRayMoved.origin, pointRayMoved.direction)
						if (hit != null)
							point.pos = hit.position
						else
						{
							let screenPos = this.viewer.pointToScreen(point.moveOrigin)
							let pointRay = this.viewer.getScreenRay(screenPos.x, screenPos.y)
							let origDistToScreen = point.moveOrigin.sub(pointRay.origin).magn()
							
							point.pos = pointRayMoved.origin.add(pointRayMoved.direction.scale(origDistToScreen))
						}
					}
				}
				
				this.refreshPanels()
			}
		}
	}
	
	
	onMouseUp(ev, x, y)
	{
		
	}
	
	
	drawAfterModel()
	{
		for (let point of this.data.cannonPoints.nodes)
		{
			let scale = (this.hoveringOverPoint == point ? 1.5 : 1) * this.viewer.getElementScale(point.pos)
			
			point.renderer
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([1, 0, 0, 1])
				
			point.rendererSelected
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([1, 0.5, 0.5, 1])
				.setEnabled(point.selected)
				
			point.rendererSelectedCore
				.setDiffuseColor([1, 0, 0, 1])
				
			let matrixDirection =
				Mat4.scale(scale, scale / 1.5, scale / 1.5)
				.mul(Mat4.rotation(new Vec3(0, 0, 1), 90 * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(1, 0, 0), point.rotation.x * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 0, 1), -point.rotation.y * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 1, 0), -point.rotation.z * Math.PI / 180))
				.mul(Mat4.translation(point.pos.x, point.pos.y, point.pos.z))
				
			point.rendererDirection
				.setCustomMatrix(matrixDirection)
				.setDiffuseColor([1, 0.75, 0.75, 1])
				.setEnabled(this.viewer.cfg.enableRotationRender)
				
			point.rendererDirectionArrow
				.setCustomMatrix(matrixDirection)
				.setDiffuseColor([1, 0, 0, 1])
				.setEnabled(this.viewer.cfg.enableRotationRender)
				
			point.rendererDirectionUp
				.setCustomMatrix(matrixDirection)
				.setDiffuseColor([1, 0.25, 0.25, 1])
				.setEnabled(this.viewer.cfg.enableRotationRender)
				
			if (point.selected && this.viewer.cfg.cannonsEnableDirectionRender)
			{
				let matrixScale = Mat4.scale(1000000, 1, 100000)
				let matrixAlign = Mat4.rotation(new Vec3(0, 0, 1), (-90 - point.rotation.y) * Math.PI / 180)
				let matrixTranslate = Mat4.translation(point.pos.x, point.pos.y, point.pos.z)
				
				point.rendererPanel
					.setCustomMatrix(matrixScale.mul(matrixAlign.mul(matrixTranslate)))
					//.setTranslation(point.pos)
					//.setScaling(new Vec3(100000, 1, 100000))
					//.setRotation(new Vec3(0, 0, 1), point.rotation.y * Math.PI / 180)
					.setDiffuseColor([1, 0.5, 0.5, 0.5])
					.setEnabled(true)
			}
			else
				point.rendererPanel.setEnabled(false)
			/*
			if (point.selected)
			{
				let index = this.data.cannonPoints.nodes.findIndex(p => p === point)
				let triggers = this.viewer.kcl.triangles.filter(t => t.flags & 0x1f == 0x11) //&& t.flags >>> 5 == index)

				for (let tri in this.viewer.kcl.triangles)
				{
					tri.color = [1, 1, 0, 1]
					tri.render = true
					refreshKcl = true
				}
			}
			*/
		}

		
		//if (refreshKcl)
			//this.window.refreshKcl(false)
		
		this.scene.render(this.viewer.gl, this.viewer.getCurrentCamera())
		this.sceneAfter.clearDepth(this.viewer.gl)
		this.sceneAfter.render(this.viewer.gl, this.viewer.getCurrentCamera())
	}
}


if (module)
	module.exports = { ViewerCannonPoints }