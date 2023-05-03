const { GfxScene, GfxCamera, GfxMaterial, GfxModel, GfxNodeRenderer, GfxNodeRendererTransform } = require("../gl/scene.js")
const { SubViewer } = require("./subViewer.js")
const { ModelBuilder } = require("../util/modelBuilder.js")
const { Vec3 } = require("../math/vec3.js")
const { Mat4 } = require("../math/mat4.js")
const { Geometry } = require("../math/geometry.js")


class PointViewer extends SubViewer
{
	constructor(window, viewer, data)
	{
		super(window, viewer, data)
			
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
	}
	
	
	refresh()
	{
		super.refresh()
		
		for (let point of this.points().nodes)
		{
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
				
			this.renderers.push(point.rendererDirection)
			this.renderers.push(point.rendererDirectionArrow)
			this.renderers.push(point.rendererDirectionUp)
		}
	}
	

	onMouseDown(ev, x, y, cameraPos, ray, hit, distToHit, mouse3DPos)
	{
		for (let point of this.points().nodes)
			point.moveOrigin = point.pos
		
		let hoveringOverElem = this.getHoveringOverElement(cameraPos, ray, distToHit)
		
		if (ev.altKey || (!ev.ctrlKey && (hoveringOverElem == null || !hoveringOverElem.selected)))
			this.unselectAll()

		if (ev.ctrlKey)
			this.ctrlIsHeld = true
		
		if (hoveringOverElem != null)
		{
			if (ev.altKey)
			{
				if (this.points().nodes.length >= this.points().maxNodes)
				{
					alert("KMP error!\n\nMaximum number of points surpassed (" + this.points().maxNodes + ")")
					return
				}
				let newPoint = this.points().addNode()
				this.points().onCloneNode(newPoint, hoveringOverElem)
				
				this.refresh()
				
				newPoint.selected = true
				this.targetPos = newPoint.moveOrigin.clone()
				this.viewer.setCursor("-webkit-grabbing")
				this.refreshPanels()
				this.window.setNotSaved()
			}
			else
			{
				hoveringOverElem.selected = true
				this.targetPos = hoveringOverElem.moveOrigin.clone()
				this.refreshPanels()
				this.viewer.setCursor("-webkit-grabbing")
			}
		}
		else if (ev.altKey)
		{
			if (this.points().nodes.length >= this.points().maxNodes)
			{
				alert("KMP error!\n\nMaximum number of points surpassed (" + this.points().maxNodes + ")")
				return
			}
			let newPoint = this.points().addNode()
			newPoint.pos = mouse3DPos
			
			this.refresh()
			newPoint.selected = true
			this.targetPos = newPoint.moveOrigin.clone()
			this.viewer.setCursor("-webkit-grabbing")
			this.refreshPanels()
			this.window.setNotSaved()
		}
	}
	
	
	onMouseMove(ev, x, y, cameraPos, ray, hit, distToHit)
	{
		// Mouse not held OR mouse held, ctrl held
		if (!this.viewer.mouseDown || this.ctrlIsHeld)
		{
			let lastHover = this.hoveringOverPoint
			this.hoveringOverPoint = this.getHoveringOverElement(cameraPos, ray, distToHit)
			
			if (this.hoveringOverPoint != null)
			{
				this.viewer.setCursor("-webkit-grab")
				if (this.ctrlIsHeld)
				{
					this.hoveringOverPoint.selected = true
					this.refreshPanels()
				}
			}
			
			if (this.hoveringOverPoint != lastHover)
				this.viewer.render()
		}
		// Mouse held, ctrl not held, holding point(s)
		else if (this.viewer.mouseAction == "move")
		{
			this.window.setNotSaved()
			this.viewer.setCursor("-webkit-grabbing")

			let moveVector = null
							
			let screenPosMoved = this.viewer.pointToScreen(this.targetPos)
			screenPosMoved.x += this.viewer.mouseMoveOffsetPixels.x
			screenPosMoved.y += this.viewer.mouseMoveOffsetPixels.y
			let pointRayMoved = this.viewer.getScreenRay(screenPosMoved.x, screenPosMoved.y)
			
			let hit = this.viewer.collision.raycast(pointRayMoved.origin, pointRayMoved.direction)
			if (this.viewer.cfg.snapToCollision && hit != null)
				moveVector = hit.position.sub(this.targetPos)
			else
			{
				let screenPos = this.viewer.pointToScreen(this.targetPos)
				let pointRay = this.viewer.getScreenRay(screenPos.x, screenPos.y)
				let origDistToScreen = this.targetPos.sub(pointRay.origin).magn()
				
				let direction = pointRayMoved.direction

				if (this.viewer.cfg.lockAxisX && this.viewer.cfg.lockAxisY && this.viewer.cfg.lockAxisZ)
				{
					return
				}
				else if (this.viewer.cfg.lockAxisX)
				{
					if (this.viewer.cfg.lockAxisY)
						direction = Geometry.lineLineProjection(pointRayMoved.origin, direction, this.targetPos, new Vec3(0, 1, 0))
					else if (this.viewer.cfg.lockAxisZ)
						direction = Geometry.lineLineProjection(pointRayMoved.origin, direction, this.targetPos, new Vec3(0, 0, 1))
					direction = direction.scale((this.targetPos.x - pointRayMoved.origin.x) / direction.x)
				}
				else if (this.viewer.cfg.lockAxisY)
				{
					if (this.viewer.cfg.lockAxisZ)
						direction = Geometry.lineLineProjection(pointRayMoved.origin, direction, this.targetPos, new Vec3(1, 0, 0))
					direction = direction.scale((this.targetPos.z - pointRayMoved.origin.z) / direction.z)
				}
				else if (this.viewer.cfg.lockAxisZ)
				{
					direction = direction.scale((this.targetPos.y - pointRayMoved.origin.y) / direction.y)
				}
				else
				{
					direction = direction.scale(origDistToScreen)
				}

				let newPos = pointRayMoved.origin.add(direction)

				if (this.viewer.cfg.lockAxisX)
					newPos.x = this.targetPos.x
				if (this.viewer.cfg.lockAxisY)
					newPos.z = this.targetPos.z
				if (this.viewer.cfg.lockAxisZ)
					newPos.y = this.targetPos.y
				
				moveVector = newPos.sub(this.targetPos)
			}

			for (let point of this.points().nodes)
			{
				if (!point.selected)
					continue
				
				point.pos = point.moveOrigin.add(moveVector)
			}
			
			this.refreshPanels()
		}
	}


    onMouseUp(ev, x, y)
	{
		this.ctrlIsHeld = false

		if (this.lastAxisHotkey) {
			this.lastAxisHotkey = ""
			this.viewer.cfg.snapToCollision = this.snapCollision
			this.viewer.cfg.lockAxisX = this.lockX
			this.viewer.cfg.lockAxisY = this.lockY
			this.viewer.cfg.lockAxisZ = this.lockZ
			this.window.refreshPanels()
		}
	}
}


if (module)
	module.exports = { PointViewer }