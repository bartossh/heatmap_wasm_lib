/// This is web worker that is strictly connected with heat map library.
/// Heat map calculation of matrix, gradient distribution, and mapping gradient
/// to canvas depends on this worker. All calculations are single threaded. 
/// 
/// TODO: 
/// - needs unit tests.
/// - it will be good to draw shapes from this worker, which will better the performance (no need to call js code any more)
///
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

extern crate nalgebra as na;
extern crate js_sys;
extern crate serde;

use core::cmp::max;
use std::cmp::min;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use na::{Matrix, Dynamic, VecStorage, DMatrix, geometry::Point2, distance};
use serde::{Serialize, Deserialize};
// #[wasm_bindgen]
// extern {
    
// }

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct HeatPoint {
    x: u32,
    y: u32,
    heat: u32
} 

impl HeatPoint {

    /// Constructs new HeatPotn instance
    /// 
    /// # Arguments:
    /// 
    /// * x - x coordinate
    /// * y - y coordinate
    /// * heat - value of heat point has from start
    ///
    /// # Returns: Self
    /// 
    fn new (x: u32, y: u32, heat: u32) -> Self {
        Self {x, y, heat}
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HeatMap {
    x_start: u32,
    y_start: u32,
    matrix: Matrix<u32, Dynamic, Dynamic, VecStorage<u32, Dynamic, Dynamic>>,
    cell_spacing: u32,
    brush_radius: u32,
    brush_intensity: u32,
    max_saturation: u32,
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
    /// * max_saturatiin - maximum value that heat point can reach (refers to max red color saturation level)
    ///
    /// # Returns: Self
    ///
    pub fn new(
        x_start: u32,
        y_start: u32,
        width: usize,
        height: usize,
        cell_spacing: u32,
        brush_radius: u32,
        brush_intensity: u32,
        max_saturation: u32,
        ) -> Self {
        let matrix = DMatrix::from_fn(height, width, |_, _| 0_u32);
        console_log!("Created {} - {}", &width, &height);
        Self {x_start, y_start, matrix, cell_spacing, brush_radius, brush_intensity, max_saturation}
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
        let max_saturation = self.max_saturation;
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
                let point: Point2<f64> = Point2::new((column * cell_spacing + x_start) as f64, (row * cell_spacing + y_start) as f64);
                let distance_from_coordinates = distance(&coordinates, &point); // nalgebra 2D euclidean distance 
                if distance_from_coordinates < (brush_radius * cell_spacing) as f64 {
                    // map grid by scaling in 2D euclidean plane 
                    *v += map_scaled_value(distance_from_coordinates, 0_f64, (brush_radius + cell_spacing) as f64, brush_intensity as f64, 0_f64, false) as u32;
                    if *v > max_saturation {
                        *v = max_saturation
                    }
                }
            }
            // We can activate row counter
            first_element = false;
        });
    }

    /// Calls passed javascript drawing function on every HeatMap matrix grid point with given context (sketch)
    /// 
    /// # Argument
    /// 
    /// * callback - javascript canvas drawing function
    /// * sketch - javascript function object holding context of canvas to draw on (*p5.js library)
    ///
    pub fn draw(&self, callback: &js_sys::Function, sketch: &js_sys::Function) {
        // zero row and acknowledge we are going to iterate matrix in row order from the first row to last row
        let mut row = 0;
        let mut first_element = true;
        &self.matrix.iter().enumerate().for_each(|(i, v)| {
            let column = (i as f64 % self.matrix.nrows() as f64) as u32;
            if column == 0 && !first_element {
                row += 1;
            }
            if *v > 0 {
                // set arguments for js apply function
                let heat_point = HeatPoint::new(column, row, *v);
                if let Ok(serialized) = serde_json::to_string(&heat_point) {
                    if let Err(_) = callback.call2(&JsValue::null(), sketch, &JsValue::from_str(&serialized)) {
                        console_log!("Error with calling callbacks passed to wasm draw functions");
                    };
                } else {
                    console_log!("Heat point cannot be serialized");
                };
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
         console_log!("{:?}", callback.call1(&JsValue::null(), &JsValue::from_f64(num)).unwrap());
    }
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
fn map_scaled_value(value: f64, start1: f64, stop1: f64, start2: f64, stop2: f64, within_bounds: bool) -> f64 {
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