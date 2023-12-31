window.addEventListener("load", () => {
  // we will keep track of all our planes in an array
  const planes = [];
  let scrollEffect = 0;
  const textList = document.querySelectorAll(".text-wrapper");

  let isHandleText = null;

  // get our planes elements
  const planeElements = document.getElementsByClassName("plane");

  // handle smooth scroll and update planes positions
  const smoothScroll = new LocomotiveScroll({
    el: document.getElementById("page-content"),
    smooth: true,
    inertia: 0.5,
    passive: true,
  });

  const useNativeScroll = smoothScroll.isMobile;

  // set up our WebGL context and append the canvas to our wrapper
  const curtains = new Curtains({
    container: "canvas",
    watchScroll: useNativeScroll, // watch scroll on mobile not on desktop since we're using locomotive scroll
    pixelRatio: Math.min(1.5, window.devicePixelRatio), // limit pixel ratio for performance
  });

  curtains
    .onRender(() => {
      if (useNativeScroll) {
        // update our planes deformation
        // increase/decrease the effect
        scrollEffect = curtains.lerp(scrollEffect, 0, 0.05);
      }
    })
    .onScroll(() => {
      // get scroll deltas to apply the effect on scroll
      const delta = curtains.getScrollDeltas();

      // invert value for the effect
      delta.y = -delta.y;

      // threshold
      if (delta.y > 60) {
        delta.y = 60;
      } else if (delta.y < -60) {
        delta.y = -60;
      }

      if (useNativeScroll && Math.abs(delta.y) > Math.abs(scrollEffect)) {
        scrollEffect = curtains.lerp(scrollEffect, delta.y, 0.5);
      } else {
        scrollEffect = curtains.lerp(scrollEffect, delta.y * 1.5, 0.5);
      }

      // manually update planes positions
      for (let i = 0; i < planes.length; i++) {
        // apply additional translation, scale and rotation
        applyPlanesParallax(i);

        // update the plane deformation uniform as well
        planes[i].uniforms.scrollEffect.value = scrollEffect;
      }
    })
    .onError(() => {
      // we will add a class to the document body to display original images
      document.body.classList.add("no-curtains", "planes-loaded");
    })
    .onContextLost(() => {
      // on context lost, try to restore the context
      curtains.restoreContext();
    });

  function updateScroll(xOffset, yOffset) {
    // update our scroll manager values
    curtains.updateScrollValues(xOffset, yOffset);
  }

  // custom scroll event
  if (!useNativeScroll) {
    // we'll render only while lerping the scroll
    curtains.disableDrawing();
    smoothScroll.on("scroll", (obj) => {
      updateScroll(obj.scroll.x, obj.scroll.y);

      // render scene
      curtains.needRender();

      // SHOW TEXT
      for (let i = 0; i < planes.length; i++) {
        if (planes[i]._shouldDraw) {
          if (i != isHandleText) {
            // console.log(textList[i]);
            isHandleText = i;
            // textList.forEach(())
            // for (let textIndex = 0; textIndex < textList.length; textIndex++) {
            //   if (textIndex == i) {
            //     textList[i].classList.add("show");
            //     console.log(textList[i]);
            //   } else {
            //     textList[i].classList.remove("show");
            //   }
            // }
          }
        }
      }
    });
  }

  // keep track of the number of plane we're currently drawing
  const debugElement = document.getElementById("debug-value");
  // we need to fill the counter with all our planes
  let planeDrawn = planeElements.length;

  const vs = `
        precision mediump float;

        // default mandatory variables
        attribute vec3 aVertexPosition;
        attribute vec2 aTextureCoord;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;

        // custom variables
        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform float uScrollEffect;

        void main() {
            vec3 vertexPosition = aVertexPosition;

            // cool effect on scroll
            vertexPosition.y += sin(((vertexPosition.x + 1.0) / 2.0) * 3.141592) * (sin(uScrollEffect / 50.0));

            gl_Position = uPMatrix * uMVMatrix * vec4(vertexPosition, 1.0);

            // varyings
            vVertexPosition = vertexPosition;
            vTextureCoord = aTextureCoord;
        }
    `;

  const fs = `
        precision mediump float;

        varying vec3 vVertexPosition;
        varying vec2 vTextureCoord;

        uniform sampler2D planeTexture;

        void main( void ) {
            // just display our texture
            gl_FragColor = texture2D(planeTexture, vTextureCoord);
        }
    `;

  const params = {
    vertexShader: vs,
    fragmentShader: fs,
    widthSegments: 10,
    heightSegments: 10,
    uniforms: {
      scrollEffect: {
        name: "uScrollEffect",
        type: "1f",
        value: 0,
      },
    },
  };

  // add our planes and handle them
  for (let i = 0; i < planeElements.length; i++) {
    const plane = new Plane(curtains, planeElements[i], params);

    planes.push(plane);

    handlePlanes(i);
  }

  // handle all the planes
  function handlePlanes(index) {
    const plane = planes[index];

    // check if our plane is defined and use it
    plane
      .onReady(() => {
        // apply parallax on load
        applyPlanesParallax(index);

        // once everything is ready, display everything
        if (index === planes.length - 1) {
          document.body.classList.add("planes-loaded");
        }
      })
      .onAfterResize(() => {
        // apply new parallax values after resize
        applyPlanesParallax(index);
      })
      .onRender(() => {
        // new way: we just have to change the rotation and scale properties directly!
        // apply the rotation
        // plane.rotation.z = Math.abs(scrollEffect) / 750;
        // // scale plane and its texture
        // plane.scale.y = 1 + Math.abs(scrollEffect) / 300;
        // plane.textures[0].scale.y = 1 + Math.abs(scrollEffect) / 150;
        /*
            // old way: using setRotation and setScale
            // plane.setRotation(new Vec3(0, 0, scrollEffect / 750));
            // plane.setScale(new Vec2(1, 1 + Math.abs(scrollEffect) / 300));
            // plane.textures[0].setScale(new Vec2(1, 1 + Math.abs(scrollEffect) / 150));
            */
      })
      .onReEnterView(() => {
        // plane is drawn again
        planeDrawn++;
        // update our number of planes drawn debug value
        debugElement.innerText = planeDrawn;
      })
      .onLeaveView(() => {
        // plane is not drawn anymore
        planeDrawn--;
        // update our number of planes drawn debug value
        debugElement.innerText = planeDrawn;
      });
  }

  function applyPlanesParallax(index) {
    // calculate the parallax effect

    // get our window size
    const sceneBoundingRect = curtains.getBoundingRect();
    // get our plane center coordinate
    const planeBoundingRect = planes[index].getBoundingRect();
    const planeOffsetTop = planeBoundingRect.top + planeBoundingRect.height / 2;
    // get a float value based on window height (0 means the plane is centered)
    const parallaxEffect =
      (planeOffsetTop - sceneBoundingRect.height / 2) /
      sceneBoundingRect.height;

    // apply the parallax effect
    planes[index].relativeTranslation.y =
      (parallaxEffect * sceneBoundingRect.height) / 4;

    /*
        // old way using setRelativeTranslation
        planes[index].setRelativeTranslation(new Vec3(0, parallaxEffect * (sceneBoundingRect.height / 4)));
         */
  }

  let newTexture;

  // post processing
  const shaderPassFs = `
   precision mediump float;

   varying vec3 vVertexPosition;
   varying vec2 vTextureCoord;

   uniform sampler2D uRenderTexture;
   uniform sampler2D displacementTexture;
   uniform sampler2D uTestTexture;

   uniform float uDisplacement;

   void main( void ) {
       vec2 textureCoords = vTextureCoord;
       vec4 displacement = texture2D(displacementTexture, textureCoords);

       // displace along Y axis
       textureCoords.y += (sin(displacement.r) / 4.0) * uDisplacement;
       
       //gl_FragColor = texture2D(uRenderTexture, textureCoords);
       
       vec4 renderTexture = texture2D(uRenderTexture, textureCoords);
       vec4 testTexture = texture2D(uTestTexture, textureCoords);

       gl_FragColor = mix(renderTexture, testTexture, vTextureCoord.x);
   }
`;

  const shaderPassParams = {
    fragmentShader: shaderPassFs, // we'll be using the lib default vertex shader
    uniforms: {
      timer: {
        name: "uTimer",
        type: "1f",
        value: 0,
      },
      displacement: {
        name: "uDisplacement",
        type: "1f",
        value: 0,
      },
    },

    texturesOptions: {
      anisotropy: 10,
    },
  };

  const shaderPass = new ShaderPass(curtains, shaderPassParams);
  // we will need to load a new image
  const image = new Image();
  image.src = "noise.png";
  // set its data-sampler attribute to use in fragment shader
  image.setAttribute("data-sampler", "displacementTexture");

  // if our shader pass has been successfully created
  if (shaderPass) {
    // load our displacement image
    // shaderPass.loader.loadImage(image);
    // shaderPass.images([]);
    shaderPass
      .onLoading((texture) => {
        console.log(
          "shader pass image has been loaded and texture has been created:",
          texture,
          shaderPass
        );
      })
      .onReady(() => {
        console.log("shader pass is ready");

        //shaderPass.loadSource(img);

        if (newTexture && !newTexture.hasParent()) {
          newTexture.addParent(shaderPass);
        }
      })
      .onRender(() => {
        // update the uniforms
        shaderPass.uniforms.timer.value++;
        shaderPass.uniforms.displacement.value = scrollEffect / 100;
      })
      .onError(() => {
        console.log("shader pass error");
      });
  }
});

const planeList = document.querySelectorAll(".plane-wrapper");
window.addEventListener("scroll", () => {
  Array.from(planeList).forEach((el) => {
    console.log(el.getBoundingClientRect());
  });

  console.log(planeList);
});
