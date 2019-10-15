/// This is web worker that is strictly connected with heat map library.
/// Heat map calculation of matrix, gradient distribution, and mapping gradient
/// to canvas depends on this worker. All calculations are single threaded.
///
/// TODO:
/// - needs unit tests.
///
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

extern crate js_sys;
extern crate nalgebra as na;
extern crate serde;
extern crate web_sys;

use core::cmp::max;
use na::{distance, geometry::Point2, DMatrix, Dynamic, Matrix, VecStorage};
use serde::{Deserialize, Serialize};
use std::cmp::min;
use std::convert::From;
// use wasm_bindgen::convert::IntoWasmAbi;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use web_sys::{CanvasRenderingContext2d, Document, HtmlCanvasElement};

// #[wasm_bindgen]
// extern {

// }

const CANVAS_ALPHA: f64 = 0.004_f64;

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// Log given attribute in browser console
///
/// #Arguments
/// * attribute - &str to be logged
///
macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

/// Re-maps a number from one range to another
/// # Arguments:
/// * value - number to remap
/// * start1 - lower bound of the value's current range
/// * stop1 - upper bound of the value's current range
/// * start2 - lower bound of the value's target range
/// * stop2 - upper bound of the value's target range
/// * within_bounds - constrain the value to the newly mapped range
///
/// # Returns: re-mapped value to new bounds
///
fn map_scaled_value(
    value: f64,
    start1: f64,
    stop1: f64,
    start2: f64,
    stop2: f64,
    within_bounds: bool,
) -> f64 {
    let newval = (value - start1) / (stop1 - start1) * (stop2 - start2) + start2;
    if !within_bounds {
        return newval;
    }
    if start2 < stop2 {
        return constrain(newval, start2, stop2);
    }
    constrain(newval, stop2, start2)
}

/// Constrains a value between a minimum and maximum value
///
/// # Arguments:
/// * value - number to constrain
/// * bound1 - minimum limit
/// * bound2 - maximum limit
/// # Returns: constrained number
///
fn constrain(value: f64, bound1: f64, bound2: f64) -> f64 {
    max(min(value as u64, bound2 as u64), bound1 as u64) as f64
}

/// Gets Web Browser Document context if available
///
/// # Arguments:
/// # Returns: Result of Web Browser Document context or empty Error otherwise
///
fn get_document() -> Result<Document, ()> {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            return Ok(document);
        }
    };
    Err(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct RGBA {
    r: u32,
    g: u32,
    b: u32,
    a: f64,
}

impl RGBA {
    /// Constructs new RGBA instance
    ///
    /// # Arguments:
    ///
    /// * r - red channel value
    /// * g - green channel value
    /// * b - blue channel value
    /// * a - alpha opacity
    ///
    /// # Returns: Self
    ///
    fn new(r: u32, g: u32, b: u32, a: f64) -> Self {
        Self { r, g, b, a }
    }
}

impl From<&RGBA> for String {
    /// Create String representation of rgba canvas color
    ///
    /// # Arguments
    /// * rgba - reference to instance of rgba structure
    ///
    /// # Returns: Self
    ///
    fn from(rgba: &RGBA) -> Self {
        format!(
            "rgba({red}, {green}, {blue}, {alpha})",
            red = rgba.r,
            green = rgba.g,
            blue = rgba.b,
            alpha = rgba.a
        )
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HeatMap {
    x_start: u32,
    y_start: u32,
    width: u32,
    height: u32,
    matrix: Matrix<u32, Dynamic, Dynamic, VecStorage<u32, Dynamic, Dynamic>>,
    cell_spacing: u32,
    brush_radius: u32,
    brush_intensity: u32,
    max_red_saturation: u32,
    ctx: CanvasRenderingContext2d,
}

#[wasm_bindgen]
impl HeatMap {
    /// Constructs new HeatMap instance
    ///
    /// # Arguments:
    ///
    /// * x_start - grid starting position x coordinate
    /// * y_start - grid starting position y coordinate
    /// * width - grid width
    /// * height - grid height
    /// * cell_spacing - space between grid points, size of each grid point
    /// * brush_radius - maximum distance of heat to reach from heat point coordinates
    /// * brush_intensity - power given for single heat point over each grid point that it is applied on (heat value is multiplied by this value)
    /// * max_red_saturation - maximum value that heat point can reach (refers to max red color saturation level)
    /// * element_id - id of canvas element to draw heatmap on
    ///
    /// # Returns: Result of Self, Err<JsValue<String>> message otherwise
    ///
    pub fn new(
        x_start: u32,
        y_start: u32,
        width: u32,
        height: u32,
        cell_spacing: u32,
        brush_radius: u32,
        brush_intensity: u32,
        max_red_saturation: u32,
        element_id: &str,
    ) -> Result<HeatMap, JsValue> {
        let matrix = DMatrix::from_fn(height as usize, width as usize, |_, _| 0_u32);
        let id = element_id.clone();
        if let Ok(document) = get_document() {
            if let Some(canvas) = document.get_element_by_id(element_id) {
                if let Ok(canvas) = canvas.dyn_into::<HtmlCanvasElement>() {
                    canvas.set_width(width as u32);
                    canvas.set_height(height as u32);
                    if let Ok(ctx) = canvas.get_context("2d") {
                        if let Some(ctx) = ctx {
                            if let Ok(ctx) = ctx.dyn_into::<CanvasRenderingContext2d>() {
                                return Ok(Self {
                                    x_start,
                                    y_start,
                                    width,
                                    height,
                                    matrix,
                                    cell_spacing,
                                    brush_radius,
                                    brush_intensity,
                                    max_red_saturation,
                                    ctx,
                                });
                            };
                        };
                    };
                    return Err(JsValue::from_str(&format!(
                        "Error with web-sys c wrapper, of web browser wasm interface"
                    )));
                };
                return Err(JsValue::from_str(&format!(
                    "Element of {} id is not a canvas",
                    &id
                )));
            };
            return Err(JsValue::from_str(&format!(
                "Cannot find element, element of id {}, does not exist",
                &id
            )));
        };
        Err(JsValue::from_str(&format!(
            "No document to refer to, please use in browser page context"
        )))
    }

    /// Applies given heat point on HeatMap matrix grid points
    ///
    /// # Argument
    ///
    /// * x - x coordinate
    /// * y - y coordinate
    /// * heat - heat value
    /// * can_apply - if true heat point will be applied, or omitted otherwise
    ///
    pub fn update(&mut self, x: u32, y: u32, heat: u32, can_apply: bool) {
        // copy or clone as we are borrowing self.matrix as mutable
        let _height = self.matrix.nrows() as f64;
        let coordinates: Point2<f64> = Point2::new(x as f64, y as f64);
        let cell_spacing = self.cell_spacing;
        let brush_radius = self.brush_radius * heat;
        let brush_intensity = self.brush_intensity * heat;
        let max_red_saturation = self.max_red_saturation;
        let x_start = self.x_start;
        let y_start = self.y_start;
        // zero row and acknowledge we are going to iterate matrix in row order from the first row to last row
        let mut row = 0;
        let mut first_element = true;
        // map received heat point to the matrix grid
        &self.matrix.iter_mut().enumerate().for_each(|(i, v)| {
            let column = (i as f64 % _height as f64) as u32;
            if column == 0 && !first_element {
                row += 1;
            }
            // cool gradient down on each pass
            if *v > 0 {
                *v -= 1;
            }
            // distribute heat
            if can_apply {
                let point: Point2<f64> = Point2::new(
                    (column * cell_spacing + x_start) as f64,
                    (row * cell_spacing + y_start) as f64,
                );
                let distance_from_coordinates = distance(&coordinates, &point); // nalgebra 2D euclidean distance
                if distance_from_coordinates < (brush_radius * cell_spacing) as f64 {
                    // map grid by scaling in 2D euclidean plane
                    *v += map_scaled_value(
                        distance_from_coordinates,
                        0_f64,
                        (brush_radius + cell_spacing) as f64,
                        brush_intensity as f64,
                        0_f64,
                        false,
                    ) as u32;
                    if *v > max_red_saturation {
                        *v = max_red_saturation
                    }
                }
            }
            // We can activate row counter
            first_element = false;
        });
    }

    /// Draws matrix gradient on canvas
    ///
    pub fn draw(&self) {
        let mut row = 0;
        let mut first_element = true;
        let color_rgbs_stringified = &String::from(&RGBA::new(255, 255, 255, 0_f64));
        self.ctx
            .clear_rect(0.0, 0.0, self.width.into(), self.height.into());
        &self.matrix.iter().enumerate().for_each(|(i, v)| {
            let column = (i as f64 % self.matrix.nrows() as f64) as u32;
            if column == 0 && !first_element {
                row += 1;
            }
            if *v > 0 {
                let mut alfa = CANVAS_ALPHA * *v as f64;
                if alfa < 0.3 {
                    alfa = 0.3;
                } else if alfa > 0.8 {
                    alfa = 0.8;
                }
                self.ctx.begin_path();
                self.ctx.rect(
                    (column * self.cell_spacing + self.x_start).into(),
                    (row * self.cell_spacing + self.y_start).into(),
                    self.cell_spacing.into(),
                    self.cell_spacing.into(),
                );
                let color_rgba_fill = RGBA::new(
                    *v,
                    (self.max_red_saturation as f64 / 2_f64) as u32 - (*v as f64 / 2_f64) as u32,
                    self.max_red_saturation - *v,
                    alfa,
                );
                let js_stringified_rgba_stroke = JsValue::from_str(&color_rgbs_stringified);
                self.ctx
                    .set_fill_style(&JsValue::from(&String::from(&color_rgba_fill)));
                self.ctx.set_stroke_style(&js_stringified_rgba_stroke);
                self.ctx.fill();
                self.ctx.stroke();
            }
            // We can activate row counter
            first_element = false;
        });
    }

    /// This function simply tests two way bindings between js and wasm
    /// it calls js callback function than logs received result in browser console
    /// This function does not refer to js callback 'this' context, and resets it to null
    ///
    /// # Arguments:
    /// * callback - javascript function to call
    /// * num - number to pass to given function
    ///
    pub fn test_js_call(&self, callback: &js_sys::Function, num: f64) {
        console_log!(
            "{:?}",
            callback
                .call1(&JsValue::null(), &JsValue::from_f64(num))
                .unwrap()
        );
    }
}
