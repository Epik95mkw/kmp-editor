const { GfxScene, GfxCamera, GfxMaterial, GfxModel, GfxNodeRenderer, GfxNodeRendererTransform } = require("../gl/scene.js")
const { PointViewer } = require("./pointViewer.js")
const { ModelBuilder } = require("../util/modelBuilder.js")
const { Vec3 } = require("../math/vec3.js")
const { Mat4 } = require("../math/mat4.js")
const { Geometry } = require("../math/geometry.js")


class ViewerCameras extends PointViewer
{
	constructor(window, viewer, data)
	{
		super(window, viewer, data)

		this.moveElems = ["pos", "viewPosStart", "viewPosEnd"]

		this.modelLink = new ModelBuilder()
			.addCylinder(-100, -100, 0, 100, 100, 1)
			.calculateNormals()
			.makeModel(viewer.gl)
	}


	points()
	{
		return this.data.cameras
	}


    refreshPanels()
	{
		let panel = this.window.addPanel("Cameras", false, (open) => { if (open) this.viewer.setSubviewer(this) })
		this.panel = panel
        
        panel.addCheckbox(null, "Draw rotation guides", this.viewer.cfg.enableRotationRender, (x) => this.viewer.cfg.enableRotationRender = x)
		panel.addText(null, "<strong>Hold Alt + Click:</strong> Create Camera")
		panel.addText(null, "<strong>Hold Alt + Drag Object:</strong> Duplicate Camera")
		panel.addText(null, "<strong>Hold Ctrl:</strong> Multiselect")
		panel.addButton(null, "(A) Select/Unselect All", () => this.toggleAllSelection())
		panel.addButton(null, "(T) Select All With Same Type", () => this.toggleAllSelectionByType())
        panel.addButton(null, "(X) Delete Selected", () => this.deleteSelectedPoints())
		panel.addButton(null, "(Y) Snap To Collision Y", () => this.snapSelectedToY())

        let firstOptions = []
		for (let i = 0; i < this.data.cameras.nodes.length; i++)
            firstOptions.push({ str: "Camera " + i + " (0x" + i.toString(16) + ")", value: i })
		panel.addSelectionDropdown(null, "Intro Start", this.data.firstIntroCam, firstOptions, true, false, (x, i) => { this.window.setNotSaved(); this.data.firstIntroCam = x })
        

        let selectedPoints = this.data.cameras.nodes.filter(p => p.selected)
		
		let selectionGroup = panel.addGroup(null, "Selection:")
		let enabled = (selectedPoints.length > 0)
		let multiedit = (selectedPoints.length > 1)

		if (selectedPoints.length == 1)
		{
			let i = this.data.cameras.nodes.findIndex(p => p === selectedPoints[0])
			panel.addText(selectionGroup, "<strong>CAME Index:</strong> " + i.toString() + " (0x" + i.toString(16) + ")")
		}

        let typeOptions =
		[
			{ str: "Goal", value: 0 },
			{ str: "FixSearch", value: 1 },
            { str: "PathSearch", value: 2 },
            { str: "KartFollow", value: 3 },
            { str: "KartPathFollow", value: 4 },
            { str: "OP_FixMoveAt", value: 5 },
            { str: "OP_PathMoveAt", value: 6 },
            { str: "MiniGame", value: 7 },
            { str: "MissionSuccess", value: 8 },
            { str: "Unknown", value: 9 },
		]
		panel.addSelectionDropdown(selectionGroup, "Type", selectedPoints.map(p => p.type), typeOptions, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].type = x; this.refresh() })
		
        let nextOptions = [{ str: "None", value: 0xff }]
		for (let i = 0; i < this.data.cameras.nodes.length; i++)
            nextOptions.push({ str: "Camera " + i + " (0x" + i.toString(16) + ")", value: i })
		panel.addSelectionDropdown(selectionGroup, "Next Camera", selectedPoints.map(p => p.nextCam), nextOptions, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].nextCam = x })

        let routeOptions = [{ str: "None", value: 0xff }]
		for (let i = 0; i < this.data.routes.length; i++)
			routeOptions.push({ str: "Route " + i + " (0x" + i.toString(16) + ")", value: i })
		panel.addSelectionDropdown(selectionGroup, "Route", selectedPoints.map(p => p.routeIndex), routeOptions, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].routeIndex = x })
		
		panel.addSelectionNumericInput(selectionGroup,       "X", -1000000, 1000000, selectedPoints.map(p =>  p.pos.x),       null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.x = x })
		panel.addSelectionNumericInput(selectionGroup,       "Y", -1000000, 1000000, selectedPoints.map(p => -p.pos.z),       null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.z = -x })
		panel.addSelectionNumericInput(selectionGroup,       "Z", -1000000, 1000000, selectedPoints.map(p => -p.pos.y),       null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].pos.y = -x })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. X", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.x),  null, 1.0,   enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.x = x % 360 }, x => { return x % 360 })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. Y", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.y),  null, 1.0,   enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.y = x % 360 }, x => { return x % 360 })
		panel.addSelectionNumericInput(selectionGroup,  "Rot. Z", -1000000, 1000000, selectedPoints.map(p =>  p.rotation.z),  null, 1.0,   enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].rotation.z = x % 360 }, x => { return x % 360 })
		
        panel.addSelectionNumericInput(selectionGroup, "Time", 0, 1000000, selectedPoints.map(p => p.time), null, 10.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].time = x })
		
        panel.addSelectionNumericInput(selectionGroup, "Point Speed", 0, 0xffff, selectedPoints.map(p => p.vCam),  1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].vCam = x })
		panel.addSelectionNumericInput(selectionGroup, "Zoom Speed",  0, 0xffff, selectedPoints.map(p => p.vZoom), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].vZoom = x })
        panel.addSelectionNumericInput(selectionGroup, "View Speed",  0, 0xffff, selectedPoints.map(p => p.vView), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].vView = x })
        
        panel.addSelectionNumericInput(selectionGroup, "Zoom Start", -1000000, 1000000, selectedPoints.map(p => p.zoomStart), null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].zoomStart = x % 360 }, x => { return x % 360 })
		panel.addSelectionNumericInput(selectionGroup, "Zoom End",   -1000000, 1000000, selectedPoints.map(p => p.zoomEnd),   null, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].zoomEnd   = x % 360 }, x => { return x % 360 })
		
        panel.addSelectionNumericInput(selectionGroup, "View Start X", -1000000, 1000000, selectedPoints.map(p =>  p.viewPosStart.x), null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewPosStart.x = x })
		panel.addSelectionNumericInput(selectionGroup, "View Start Y", -1000000, 1000000, selectedPoints.map(p => -p.viewPosStart.z), null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewPosStart.z = -x })
		panel.addSelectionNumericInput(selectionGroup, "View Start Z", -1000000, 1000000, selectedPoints.map(p => -p.viewPosStart.y), null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewPosStart.y = -x })
		panel.addSelectionNumericInput(selectionGroup,   "View End X", -1000000, 1000000, selectedPoints.map(p =>  p.viewPosEnd.x),   null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewPosEnd.x = x })
		panel.addSelectionNumericInput(selectionGroup,   "View End Y", -1000000, 1000000, selectedPoints.map(p => -p.viewPosEnd.z),   null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewPosEnd.z = -x })
		panel.addSelectionNumericInput(selectionGroup,   "View End Z", -1000000, 1000000, selectedPoints.map(p => -p.viewPosEnd.y),   null, 100.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].viewPosEnd.y = -x })
		
        panel.addSelectionNumericInput(selectionGroup, "Shake(?)",  0, 0xff, selectedPoints.map(p => p.shake), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].shake = x })
        panel.addSelectionNumericInput(selectionGroup, "Start(?)",  0, 0xff, selectedPoints.map(p => p.start), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].start = x })
        panel.addSelectionNumericInput(selectionGroup, "Movie(?)",  0, 0xff, selectedPoints.map(p => p.movie), 1.0, 1.0, enabled, multiedit, (x, i) => { this.window.setNotSaved(); selectedPoints[i].movie = x })
    }


    refresh()
	{
		for (let point of this.data.cameras.nodes)
		{
			if (point.selected === undefined)
			{
				point.selected = {}
				point.moveOrigin = {}

				for (let e of this.moveElems)
				{
					point.selected[e] = false
					point.moveOrigin[e] = point[e]
				}
			}
		}
			
		super.refresh()

		for (let point of this.data.cameras.nodes)
		{
			point.rViewStart = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)

			point.rViewStartSelected = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelPointSelection)
				.setMaterial(this.viewer.materialUnshaded)
				.setEnabled(false)
				
			point.rViewStartSelectedCore = new GfxNodeRenderer()
				.attach(point.rendererSelected)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)
			
			point.rViewStartLink = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelLink)
				.setMaterial(this.viewer.material)
				
			
			point.rViewEnd = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)

			point.rViewEndSelected = new GfxNodeRendererTransform()
				.attach(this.sceneAfter.root)
				.setModel(this.modelPointSelection)
				.setMaterial(this.viewer.materialUnshaded)
				.setEnabled(false)
				
			point.rViewEndSelectedCore = new GfxNodeRenderer()
				.attach(point.rendererSelected)
				.setModel(this.modelPoint)
				.setMaterial(this.viewer.material)

			point.rViewEndLink = new GfxNodeRendererTransform()
				.attach(this.scene.root)
				.setModel(this.modelLink)
				.setMaterial(this.viewer.material)
				
            this.renderers.push(point.rViewStart)
			this.renderers.push(point.rViewStartSelected)
			this.renderers.push(point.rViewStartSelectedCore)
			this.renderers.push(point.rViewStartLink)
			this.renderers.push(point.rViewEnd)
			this.renderers.push(point.rViewEndSelected)
			this.renderers.push(point.rViewStartSelectedCore)
			this.renderers.push(point.rViewEndLink)

			point.rendererLinks = [point.rViewStartLink, point.rViewEndLink]
		}
		
		this.refreshPanels()
	}

	
	getHoveringOverElement(cameraPos, ray, distToHit, includeSelected = true)
	{
		let elem = null
		
		let minDistToCamera = distToHit + 1000
		let minDistToPoint = 1000000
		for (let e of this.moveElems)
		{
			for (let point of this.data.cameras.nodes)
			{
				if (!includeSelected && point.selected[e])
					continue
				
				let distToCamera = point[e].sub(cameraPos).magn()
				if (distToCamera >= minDistToCamera)
					continue
				
				let scale = this.viewer.getElementScale(point[e])
				
				let pointDistToRay = Geometry.linePointDistance(ray.origin, ray.direction, point[e])
				
				if (pointDistToRay < 150 * scale * 4 && pointDistToRay < minDistToPoint)
				{
					elem = { point, which: e }
					minDistToCamera = distToCamera
					minDistToPoint = pointDistToRay
				}
			}
		}
		
		return elem
	}
	

    toggleAllSelectionByType()
	{
		let selectedPoints = this.data.cameras.nodes.filter(p => p.selected)
		
		for (let point of this.data.cameras.nodes)
			point.selected = (selectedPoints.find(p => p.type == point.type) != null)
		
		this.refreshPanels()
	}


    onKeyDown(ev)
	{
		if (super.onKeyDown(ev))
			return true
		
		switch (ev.key)
		{
			case "T":
			case "t":
				this.toggleAllSelectionByType()
				return true
		}
		
		return false
	}

	
	onMouseDown(ev, x, y, cameraPos, ray, hit, distToHit, mouse3DPos)
	{
		this.linkingPoints = false
		
		for (let point of this.data.cameras.nodes)
			point.moveOrigin = this.moveElems.reduce((obj, p) => { obj[p] = point[p] }, {})
		
		let hoveringOverElem = this.getHoveringOverElement(cameraPos, ray, distToHit)
		
		if (ev.altKey || (!ev.ctrlKey && (hoveringOverElem == null || !hoveringOverElem.point.selected[hoveringOverElem.which])))
			this.unselectAll()

		if (ev.ctrlKey)
			this.multiSelect = true
		
		if (hoveringOverElem != null)
		{
			if (ev.altKey)
			{
				if (hoveringOverElem.which !== "pos")
					return
				
				if (this.data.cameras.nodes.length >= this.data.cameras.maxNodes)
				{
					alert("KMP error!\n\nMaximum number of points surpassed (" + this.data.cameras.maxNodes + ")")
					return
				}

				let newPoint = this.data.cameras.addNode()
				this.data.cameras.onCloneNode(newPoint, hoveringOverElem)
				
				this.refresh()
				
				newPoint.selected = this.moveElems.reduce((obj, p) => { obj[p] = true }, {})
				this.viewer.setCursor("-webkit-grabbing")
				this.refreshPanels()
				this.window.setNotSaved()
			}
			else
			{
				hoveringOverElem.point.selected[hoveringOverElem.which] = true
				this.refreshPanels()
				this.viewer.setCursor("-webkit-grabbing")
			}
		}
		else if (ev.altKey)
		{
			if (this.data.cameras.nodes.length >= this.data.cameras.maxNodes)
			{
				alert("KMP error!\n\nMaximum number of points surpassed (" + this.data.cameras.maxNodes + ")")
				return
			}
			let newPoint = this.data.cameras.addNode()
			newPoint.pos = mouse3DPos
			newPoint.viewPosStart = mouse3DPos.add(new Vec3(100, 0, 0))
			newPoint.viewPosEnd = mouse3DPos.add(new Vec3(-100, 0, 0))
			
			this.refresh()
			newPoint.selected = this.moveElems.reduce((obj, p) => { obj[p] = true }, {})
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
			{
				this.viewer.setCursor("-webkit-grab")
			
				if (lastHover == null ||
					this.hoveringOverPoint.point != lastHover.point ||
					this.hoveringOverPoint.which != lastHover.which)
					this.viewer.render()
			}
			else if (lastHover != null)
				this.viewer.render()
		}
		else if (ev.ctrlKey)
		{
			let lastHover = this.hoveringOverPoint
			this.hoveringOverPoint = this.getHoveringOverElement(cameraPos, ray, distToHit)
			
			if (this.hoveringOverPoint != null)
			{
				this.viewer.setCursor("-webkit-grab")
				this.hoveringOverPoint.point.selected[this.hoveringOverPoint.which] = true
				this.refreshPanels()

				if (lastHover == null ||
					this.hoveringOverPoint.point != lastHover.point ||
					this.hoveringOverPoint.which != lastHover.which)
					this.viewer.render()
			}
			else if (lastHover != null)
				this.viewer.render()
		}
		else if (!this.multiSelect && this.viewer.mouseAction == "move")
		{
			let linkToPoint = this.getHoveringOverElement(cameraPos, ray, distToHit, false)
			
			for (let point of this.data.cameras.nodes)
			{
				for (let e of this.moveElems)
				{
					if (!point.selected)
						continue
					
					this.window.setNotSaved()
					this.viewer.setCursor("-webkit-grabbing")
					
					if (this.linkingPoints && linkToPoint != null)
					{
						point[e] = linkToPoint[e]
					}
					else
					{					
						let screenPosMoved = this.viewer.pointToScreen(point.moveOrigin)
						screenPosMoved.x += this.viewer.mouseMoveOffsetPixels.x
						screenPosMoved.y += this.viewer.mouseMoveOffsetPixels.y
						let pointRayMoved = this.viewer.getScreenRay(screenPosMoved.x, screenPosMoved.y)
						
						let hit = this.viewer.collision.raycast(pointRayMoved.origin, pointRayMoved.direction)
						if (hit != null)
							point[e] = hit.position
						else
						{
							let screenPos = this.viewer.pointToScreen(point.moveOrigin)
							let pointRay = this.viewer.getScreenRay(screenPos.x, screenPos.y)
							let origDistToScreen = point.moveOrigin.sub(pointRay.origin).magn()
							
							point[e] = pointRayMoved.origin.add(pointRayMoved.direction.scale(origDistToScreen))
						}
					}
				}
			}
			
			this.refreshPanels()
		}
	}
	

    drawAfterModel()
	{
		for (let point of this.data.cameras.nodes)
		{
			let scale = (this.hoveringOverPoint == point ? 1.5 : 1) * this.viewer.getElementScale(point.pos)
			
			point.renderer
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.5, 0.1, 0.7, 1])
				
			point.rendererSelected
				.setTranslation(point.pos)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.7, 0.1, 1, 1])
				.setEnabled(point.selected)
				
			point.rendererSelectedCore
				.setDiffuseColor([0.5, 0.1, 0.7, 1])
				
            let pointScale = Mat4.scale(scale, scale / 1.5, scale / 1.5)
            let matrixDirection =
				Mat4.rotation(new Vec3(0, 0, 1), 90 * Math.PI / 180)
				.mul(Mat4.rotation(new Vec3(1, 0, 0), point.rotation.x * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 0, 1), -point.rotation.y * Math.PI / 180))
				.mul(Mat4.rotation(new Vec3(0, 1, 0), -point.rotation.z * Math.PI / 180))
				.mul(Mat4.translation(point.pos.x, point.pos.y, point.pos.z))
				
			point.rendererDirection
				.setCustomMatrix(pointScale.mul(matrixDirection))
				.setDiffuseColor([0.7, 0.1, 1, 1])
				.setEnabled(this.viewer.cfg.enableRotationRender)
				
			point.rendererDirectionArrow
				.setCustomMatrix(pointScale.mul(matrixDirection))
				.setDiffuseColor([0.5, 0.1, 0.8, 1])
				.setEnabled(this.viewer.cfg.enableRotationRender)
				
			point.rendererDirectionUp
				.setCustomMatrix(pointScale.mul(matrixDirection))
				.setDiffuseColor([0.75, 0.1, 1, 1])
				.setEnabled(this.viewer.cfg.enableRotationRender)
			
			point.rViewStart
				.setTranslation(point.viewPosStart)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.1, 0.8, 0.1, 1])
			
			point.rViewStartSelected
				.setTranslation(point.viewPosStart)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.2, 1.0, 0.2, 1])
				.setEnabled(point.selected)
			
			point.rViewStartSelectedCore
				.setDiffuseColor([0.1, 0.8, 0.1, 1])
			
			point.rViewEnd
				.setTranslation(point.viewPosEnd)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([0.8, 0.1, 0.1, 1])
			
			point.rViewEndSelected
				.setTranslation(point.viewPosEnd)
				.setScaling(new Vec3(scale, scale, scale))
				.setDiffuseColor([1.0, 0.2, 0.2, 1])
				.setEnabled(point.selected)
			
			point.rViewEndSelectedCore
				.setDiffuseColor([0.8, 0.1, 0.1, 1])
			
			let viewPosList = [point.viewPosStart, point.viewPosEnd]
			/*for (let n = 0; n < 2; n++)
			{
				nextPos = viewPosList[n]
				
				let matrixScale = Mat4.scale(scale, scale, nextPos.sub(point.pos).magn())
				let matrixAlign = Mat4.rotationFromTo(new Vec3(0, 0, 1), nextPos.sub(point.pos).normalize())
				let matrixTranslate = Mat4.translation(point.pos.x, point.pos.y, point.pos.z)
				
				point.rendererLinks[n]
					.setCustomMatrix(matrixScale.mul(matrixAlign.mul(matrixTranslate)))
					.setDiffuseColor([0.5, 0.5, 0.5, 0.5])
			}*/
		}
		
		this.scene.render(this.viewer.gl, this.viewer.getCurrentCamera())
		this.sceneAfter.clearDepth(this.viewer.gl)
		this.sceneAfter.render(this.viewer.gl, this.viewer.getCurrentCamera())
	}
}


if (module)
	module.exports = { ViewerCameras }